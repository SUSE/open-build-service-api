/**
 * This module provides the high level methods to access and modify projects
 */

import xml2js = require("xml2js");

const xmlParser = new xml2js.Parser({ explicitArray: false, async: true });
const xmlBuilder = new xml2js.Builder();

import { promises as fsPromises } from "fs";
import { join } from "path";
import { getDirectory } from "./api/directory";
import {
  getProjectMeta,
  modifyProjectMeta,
  ProjectMeta
} from "./api/project-meta";
import { Connection, RequestMethod, normalizeUrl } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import { Package } from "./package";
import { deleteUndefinedAndEmptyMembers } from "./util";

/** Container to store the information about a Project on OBS */
export interface Project {
  /** Url to the API from which this project was retrieved */
  readonly apiUrl: string;

  /** Full name of this project */
  name: string;

  /** Array of packages that belong to this project */
  packages?: Package[];

  /** This project's meta configuration */
  meta?: ProjectMeta;
}

/**
 * Retrieves the list of packages of the given project
 *
 * @return Array of [[Package]], when the project contains packages or undefined
 *     when it contains none
 */
async function fetchPackageList(
  con: Connection,
  projectName: string
): Promise<Package[] | undefined> {
  let packages: Package[] | undefined;

  const dir = await getDirectory(con, `/source/${projectName}`);

  if (dir.directoryEntries === undefined || dir.directoryEntries.length === 0) {
    packages = undefined;
  } else {
    packages = [];
    dir.directoryEntries.forEach(dentry => {
      if (dentry.name !== undefined) {
        packages!.push({ name: dentry.name, project: projectName });
      }
    });
  }
  return packages;
}

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
export async function getProject(
  con: Connection,
  projectName: string,
  getPackageList: boolean = true
): Promise<Project> {
  const meta = await getProjectMeta(con, projectName);
  const packages = getPackageList
    ? await fetchPackageList(con, projectName)
    : undefined;

  const res = { apiUrl: con.url, name: projectName, meta, packages };
  deleteUndefinedAndEmptyMembers(res);
  return res;
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
    package?: PackageEntry[];
  };
}

/**
 * Check a project out locally on the file system (= equivalent of `osc co $proj`)
 *
 * @param proj  The [[Project]] that should be checked out. If the package list
 *     is empty, then this function will not add packages into the local
 *     checkout.
 *     Note, if the project was retrieved via [[getProject]], then be sure to
 *     set `getPackageList` to `true`, as the list of packages will otherwise
 *     not be retrieved.
 * @param path  Path to the directory into which the project should be checked
 *     out. This folder must not exist.
 *
 * @note This function does not perform any http requests, so the `proj` needs
 *     to be fully populated beforehand.
 *
 * @throw Error when `path` is not writable or the `path` already exists.
 *
 * @return nothing
 */
export async function checkOut(proj: Project, path: string): Promise<void> {
  await fsPromises.mkdir(path, { recursive: false });
  await fsPromises.mkdir(join(path, ".osc"), { recursive: false });

  const underscorePackages: UnderscorePackages = {
    project: { $: { name: proj.name } }
  };
  if (proj.packages !== undefined && proj.packages.length > 0) {
    underscorePackages.project.package = proj.packages.map(pkg => {
      return { $: { name: pkg.name, state: " " } };
    });
  }
  const underscorePackagesContents = xmlBuilder.buildObject(underscorePackages);

  await Promise.all(
    [
      ["_apiurl", proj.apiUrl],
      ["_project", proj.name],
      ["_packages", underscorePackagesContents]
    ].map(entries => {
      const [fname, contents] = entries;
      return fsPromises.writeFile(join(path, ".osc", fname), contents);
    })
  );
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
  let packages: undefined | Package[];

  let [apiUrl, name, underscorePackagesContents] = await Promise.all(
    ["_apiurl", "_project", "_packages"].map(async fname =>
      (await fsPromises.readFile(join(path, ".osc", fname))).toString().trim()
    )
  );

  apiUrl = normalizeUrl(apiUrl);

  const underscorePackages: UnderscorePackages = await xmlParser.parseStringPromise(
    underscorePackagesContents
  );
  if (
    underscorePackages.project.package !== undefined &&
    underscorePackages.project.package.length > 0
  ) {
    packages = underscorePackages.project.package.map(pkg => {
      return { name: pkg.$.name, project: name };
    });
  }

  return deleteUndefinedAndEmptyMembers({ apiUrl, name, packages });
}

/**
 * Create a new project on the build service instance.
 */
export async function createProject(
  con: Connection,
  proj: ProjectMeta
): Promise<StatusReply> {
  return modifyProjectMeta(con, proj);
}

/**
 * Removes the project with the given name.
 */
export async function deleteProject(
  con: Connection,
  projectName: string
): Promise<StatusReply> {
  const resp = await con.makeApiCall(`/source/${projectName}`, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(resp);
}
