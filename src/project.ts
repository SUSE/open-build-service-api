/**
 * Copyright (c) 2019-2020 SUSE LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * This module provides the high level methods to access and modify projects.
 *
 * Projects can be read in via OBS' API using [[fetchProject]] or from the file
 * system via [[readInCheckedOutProject]]. When reading in projects from the
 * file system, we expect them to have a similar layout as created by running
 * `osc checkout`.
 *
 * Differences to `osc`'s behavior:
 * - We create & read out the `.osc_obs_ts/_project_meta.json` file, into which
 *   we save the project's `_meta`.
 * - We do not use the `state` field from `.osc/_packages`. This behavior might
 *   change in the future.
 */

import * as assert from "assert";
import { promises as fsPromises } from "fs";
import { join } from "path";
import { directoryFromApi, fetchDirectory } from "./api/directory";
import {
  fetchProjectMeta,
  modifyProjectMeta,
  ProjectMeta
} from "./api/project-meta";
import { Connection, normalizeUrl, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import { checkOutPackageToFs, fetchPackage, Package } from "./package";
import { setDifference } from "./set-utils";
import {
  createOrEnsureEmptyDir,
  deleteUndefinedAndEmptyMembers,
  deleteUndefinedMembers,
  mapOrApply,
  pathExists,
  PathType,
  zip,
  rmRf
} from "./util";
import { newXmlBuilder, newXmlParser } from "./xml";

/**
 * The files in the `.osc` subdirectory where the information about each project
 * are stored.
 */
const projectUnderscoreFiles = ["_apiurl", "_project", "_packages"];

/** The files that are stored in the [[dotOscPluginSubdir]] subdirectory. */
const obsTsProjectUnderscoreFiles = ["_project_meta.json"];

/**
 * The subdirectory into which we put additional files that are related to the
 * project for caching.
 * `osc` does not handle additional files in `.osc/` and thus we store them in
 * this directory instead to avoid compatibility issues.
 */
const dotOscPluginSubdir = ".osc_obs_ts";

/** Container to store the information about a Project on OBS */
export interface Project {
  /** Url to the API from which this project was retrieved */
  readonly apiUrl: string;

  /** Full name of this project */
  name: string;

  /**
   * Array of packages that belong to this project.
   *
   * Note: this list need not be exhaustive! E.g. when a project has been only
   * partially checked out (= only a subset of all packages is cloned), then the
   * `packages` array **must** only contain these.
   *
   * When the `packages` entry is `undefined`, then no packages have been
   * fetched yet. It does **not** mean that there are no packages! That is
   * indicated by an empty array.
   */
  packages?: Package[];

  /** This project's meta configuration */
  meta?: ProjectMeta;
}

/** A project where the package list is guaranteed to exist */
export type ProjectWithPackages = Omit<Project, "packages"> & {
  packages: Package[];
};

/**
 * Retrieves the list of packages of the given project
 *
 * @return Array of [[Package]], when the project contains packages or an empty
 *     array when it contains none
 */
async function fetchPackageList(
  con: Connection,
  project: Project
): Promise<Package[]> {
  const dir = await fetchDirectory(con, `/source/${project.name}`);

  if (dir.directoryEntries === undefined || dir.directoryEntries.length === 0) {
    return [];
  } else {
    const packages: Package[] = [];
    dir.directoryEntries.forEach((dentry) => {
      if (dentry.name !== undefined) {
        packages.push({
          apiUrl: project.apiUrl,
          name: dentry.name,
          projectName: project.name
        });
      }
    });

    return packages;
  }
}

export async function fetchProject(
  con: Connection,
  projectName: string,
  options: { getPackageList: true }
): Promise<ProjectWithPackages>;

export async function fetchProject(
  con: Connection,
  projectName: string,
  options?: { getPackageList?: boolean }
): Promise<Project>;

/**
 * Get a [[Project]] structure from the build service instance.
 *
 * @param con  The [[Connection]] that will be used to make the API calls.
 * @param projectName  Full name of the project
 * @param getPackageList  Flag whether the [[Project.packages]] attribute should
 *     be filled too. This results in another API call and might result in a lot
 *     of network traffic for **huge** projects (think of `openSUSE:Factory` on
 *     build.opensuse.org).
 */
export async function fetchProject(
  con: Connection,
  projectName: string,
  options?: { getPackageList?: boolean }
): Promise<Project> {
  const meta = await fetchProjectMeta(con, projectName);
  const proj = {
    apiUrl: con.url,
    name: projectName,
    meta
  };
  if (options?.getPackageList === undefined || options.getPackageList) {
    return deleteUndefinedMembers({
      ...proj,
      packages: await fetchPackageList(con, proj)
    });
  } else {
    return proj;
  }
}

/** A package entry in `.osc/_packages` */
interface PackageEntry {
  $: {
    /** Name of the package */
    name: string;

    /**
     * state flag, describing the whether the package is modified, deleted,
     * etc. with respect to the state on the OBS instance.
     *
     * Defaults to `" "`.
     * FIXME: handle this properly
     * (see: read_packages() from osc/core.py)
     */
    state: string;
  };
}

/** Representation of the `.osc/_packages` file when parsed by xml2js */
interface UnderscorePackages {
  project: {
    $: {
      /** Name of the project */
      name: string;
    };
    /** package list, only present if packages are there */
    package?: PackageEntry[] | PackageEntry;
  };
}

/**
 * Write the project settings into the `_apiurl`, `_project` and `_packages`
 * file into the `.osc` subdirectory of `path`. Save the project's `_meta` into
 * `.osc_obs_ts/_project_meta.json` if `proj.meta` is not undefined.
 *
 * If these files exist, then their contents are overwritten. If `path/.osc`
 * does not exist, then an exception will be thrown. If `path/.osc_obs_ts` does
 * not exist, then it will be created, but only if the project meta is not
 * `undefined`.
 *
 * **Caution**: The directory `path` must already exist.
 */
async function writeProjectUnderscoreFiles(
  proj: Project,
  path: string
): Promise<void> {
  assert(
    (await pathExists(path, PathType.Directory)) !== undefined,
    `${path} must already exist and be a directory`
  );

  const underscorePackages: UnderscorePackages = {
    project: { $: { name: proj.name } }
  };
  if (proj.packages !== undefined && proj.packages.length > 0) {
    underscorePackages.project.package = proj.packages.map((pkg) => {
      return { $: { name: pkg.name, state: " " } };
    });
  }
  const underscorePackagesContents = newXmlBuilder().buildObject(
    underscorePackages
  );

  if (proj.meta !== undefined) {
    // it's ok to use recursive here as path is guaranteed to exist
    await fsPromises.mkdir(join(path, dotOscPluginSubdir), { recursive: true });
  }
  const projMetaApiJson =
    proj.meta !== undefined ? JSON.stringify(proj.meta) : undefined;

  await Promise.all(
    [
      { fname: join(path, ".osc", "_apiurl"), contents: proj.apiUrl },
      { fname: join(path, ".osc", "_project"), contents: proj.name },
      {
        fname: join(path, ".osc", "_packages"),
        contents: underscorePackagesContents
      },
      {
        fname: join(path, dotOscPluginSubdir, "_project_meta.json"),
        contents: projMetaApiJson
      }
    ].map(({ fname, contents }) => {
      return contents === undefined
        ? Promise.resolve()
        : fsPromises.writeFile(fname, contents);
    })
  );
}

/**
 * Check a project and its packages out locally to the file system (= equivalent
 * of `osc co $proj`).
 *
 *
 * @param con  The [[Connection]] which will be used to retrieve the project and
 *     the packages.
 * @param proj  The [[Project]] or the name of the project that should be checked
 *     out.
 * @param path  Path to the directory into which the project should be checked
 *     out. If the folder does not exist, then it is created. If it exists, then
 *     it must be empty and writable.
 * @param packageList  An array of package names that will be checked out (and
 *     all that are missing on this list are not checked out). If this parameter
 *     is not provided, then all packages are checked out.
 * @param callback  An optional callback function that is invoked after each
 *     package is checked out. This function passes the same parameters to the
 *     callback as `Array.map` would (i.e. the name of the package that was
 *     checked out, its index in the array and the whole array).
 * @param cancellationToken  A token that will cancel the checkout if it is set
 *     to true. It is checked after each package is checked out to the file
 *     system. If the cancellation is requested, then the contents of the
 *     directory are cleaned up.
 *
 * @return `true` when the project was checked out successfully or `false` if it
 *     was canceled.
 *
 * @throw
 *     - `Error` when `path` is not writable or the `path` already exists.
 *     - `Error` when the `packageList` parameter contains package names that do not
 *       exist in the project.
 *     - [[ApiError]] when fetching the project or package fails.
 */
export async function checkOutProject(
  con: Connection,
  project: string | Project,
  path: string,
  options?: {
    packageList?: string[];
    callback?: (pkgName: string, index: number, pkgNames: string[]) => void;
    cancellationToken?: { isCancellationRequested: boolean };
  }
): Promise<boolean> {
  await createOrEnsureEmptyDir(path);

  const projectName = typeof project === "string" ? project : project.name;
  const proj = await fetchProject(con, projectName, { getPackageList: true });

  if (options?.packageList !== undefined) {
    const invalidPackages = setDifference(
      new Set(options.packageList),
      new Set(proj.packages.map((pkg) => pkg.name))
    );
    if (invalidPackages.size > 0) {
      throw new Error(
        `invalid package list provided, the following packages are not known to the project: ${[
          ...invalidPackages
        ].join(", ")}`
      );
    }
  }

  const cleanup = async () => {
    await rmRf(path);
    await fsPromises.mkdir(path, { recursive: false });
  };

  const pkgNames = options?.packageList ?? proj.packages.map((pkg) => pkg.name);

  await fsPromises.mkdir(join(path, ".osc"), { recursive: false });
  await writeProjectUnderscoreFiles(proj, path);

  if (options?.cancellationToken?.isCancellationRequested ?? false) {
    await cleanup();
    return false;
  }

  const indexes = pkgNames.map((_val, i) => i);

  for (const [pkgName, index] of zip(pkgNames, indexes)) {
    const pkg = await fetchPackage(con, project, pkgName, {
      retrieveFileContents: true,
      expandLinks: true
    });
    await checkOutPackageToFs(pkg, join(path, pkg.name));

    if (options?.callback !== undefined) {
      options.callback(pkgName, index, pkgNames);
    }
    if (options?.cancellationToken?.isCancellationRequested ?? false) {
      await cleanup();
      return false;
    }
  }

  return true;
}

/**
 * Reads a checked out project and creates a [[Project]] structure from that.
 *
 * @param path  Path to the directory where the project is checked out (the path
 *     should include the `.osc` directory).
 *
 * @throw Error on exceptions thrown by the fs module.
 *
 * @return A [[Project]] structure populated with the values from the underscore
 *     files in the `.osc` subdirectory.
 */
export async function readInCheckedOutProject(path: string): Promise<Project> {
  const [
    apiUrl,
    name,
    underscorePackagesContents,
    projMetaContents
  ] = await Promise.all(
    projectUnderscoreFiles
      .map(async (fname) =>
        (await fsPromises.readFile(join(path, ".osc", fname))).toString().trim()
      )
      .concat(
        obsTsProjectUnderscoreFiles.map(async (fname) => {
          try {
            return (
              await fsPromises.readFile(join(path, dotOscPluginSubdir, fname))
            )
              .toString()
              .trim();
          } catch {
            return "";
          }
        })
      )
  );

  const meta =
    projMetaContents !== "" ? JSON.parse(projMetaContents) : undefined;
  const project: Project = {
    apiUrl: normalizeUrl(apiUrl),
    name,
    meta
  };

  // let's just assume that the contents of the file are well formed,
  // otherwise something will blow up later anyway.
  const underscorePackages = (await newXmlParser().parseStringPromise(
    underscorePackagesContents
  )) as UnderscorePackages;
  if (underscorePackages.project.package !== undefined) {
    project.packages = mapOrApply(
      underscorePackages.project.package,
      (pkg) => ({
        apiUrl: project.apiUrl,
        name: pkg.$.name,
        projectName: project.name
      })
    );
  }

  return deleteUndefinedAndEmptyMembers(project);
}

/**
 * Updates the project settings on disk with the settings from `proj`.
 *
 * @param proj  The settings which should be applied to the checked out project.
 * @param checkedOutPath  Path where the project has been checked out to.
 *
 * @throw
 * - Error when the [[Project.name]] or [[Project.apiUrl]] of the new settings
 *   and of the checked out version do not match.
 * - Errors from the `fs` module if the settings files are not read- or
 *   write-able.
 */
export async function updateCheckedOutProject(
  proj: Project,
  checkedOutPath: string
): Promise<void> {
  // if path is not a valid project, then this will throw an exception
  const storedProj = await readInCheckedOutProject(checkedOutPath);

  // eh, we are updating something completely different => bail
  if (storedProj.name !== proj.name || storedProj.apiUrl !== proj.apiUrl) {
    throw new Error(
      `Cannot update the project ${storedProj.name} from ${storedProj.apiUrl} with settings of the project ${proj.name} from ${proj.apiUrl}`
    );
  }

  await writeProjectUnderscoreFiles(proj, checkedOutPath);
}

/**
 * Create a new project on the build service instance.
 */
export async function createProject(
  con: Connection,
  projMeta: ProjectMeta
): Promise<StatusReply> {
  return modifyProjectMeta(con, projMeta);
}

/**
 * Removes the given project or the project with the given name.
 *
 * @param project  Either the name of the project that should be deleted or a
 *     [[Project]] instance.
 */
export async function deleteProject(
  con: Connection,
  project: string | Project
): Promise<StatusReply> {
  const route =
    typeof project === "string"
      ? `/source/${project}`
      : `/source/${project.name}`;
  const resp = await con.makeApiCall(route, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(resp);
}

/**
 * Retrieves the list of all projects that are known to the respective instance
 * of the build service.
 */
export async function fetchProjectList(
  con: Connection
): Promise<readonly Project[]> {
  const projectsDir = directoryFromApi(await con.makeApiCall("/source"));
  if (
    projectsDir.directoryEntries === undefined ||
    !Array.isArray(projectsDir.directoryEntries)
  ) {
    throw new Error(
      `Invalid response received from OBS, expected an array of directory entries, but got '${projectsDir.directoryEntries}' instead`
    );
  }
  return Object.freeze(
    projectsDir.directoryEntries.map((dentry) => ({
      apiUrl: con.url,
      name: dentry.name!
    }))
  );
}
