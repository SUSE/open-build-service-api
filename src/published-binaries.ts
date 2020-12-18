/**
 * Copyright (c) 2020 SUSE LLC
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

import { Arch } from "./api/base-types";
import { fetchDirectory } from "./api/directory";
import { fetchProjectMeta } from "./api/project-meta";
import { Configuration, fetchConfiguration } from "./configuration";
import { Connection } from "./connection";
import { isXmlParseError } from "./error";
import { BaseProject } from "./project";
import { dropUndefined } from "./util";

type ProjectName = BaseProject | Omit<BaseProject, "apiUrl"> | string;

async function fetchDirectoryNames(
  con: Connection,
  route: string
): Promise<string[]> {
  const { directoryEntries } = await fetchDirectory(con, route);
  if (directoryEntries === undefined || directoryEntries.length === 0) {
    return [];
  }
  return directoryEntries.map((dentry) => dentry.name!);
}

/**
 * Fetch the list of published projects on the OBS instance belonging to `con`.
 */
export async function fetchPublishedProjects(
  con: Connection
): Promise<string[]> {
  return await fetchDirectoryNames(con, "/published");
}

/**
 * Fetch the list of published repositories for the given project.
 */
export async function fetchPublishedRepositories(
  con: Connection,
  project: ProjectName
): Promise<string[]> {
  return await fetchDirectoryNames(
    con,
    `/published/${typeof project === "string" ? project : project.name}`
  );
}

/**
 * Fetch the contents of a single directory in a published repository.
 *
 * This function can be a bit awkward to use due to the way OBS' backend works:
 * it will return the contents of the supplied repository (and optional
 * architecture-subdirectories or other subdirectories), but it cannot tell you
 * whether the contents are actually files or directories. This means that you
 * can request a file by accident, thinking that it was actually a
 * subdirectory. If that happens, then you'll get `undefined` instead.
 *
 * Examples:
 * ```typescript
 * // fetch the contents of the top level directory of Virtualization:vagrant:
 * await fetchPublishedRepositoryContents(
 *   con,
 *   "Virtualization:vagrant",
 *   "openSUSE_Tumbleweed"
 * );
 * // returns:
 * // [
 * //   "Virtualization:vagrant.repo",
 * //   "i586",
 * //   "noarch",
 * //   "repocache",
 * //   "repodata",
 * //   "src",
 * //   "x86_64"
 * // ];
 *
 * // fetch the contents of the x86_64 subdirectory:
 * await fetchPublishedRepositoryContents(
 *   con,
 *   "Virtualization:vagrant",
 *   "openSUSE_Tumbleweed",
 *   { arch: Arch.X86_64 }
 * );
 * // fetch the contents of the `src` subdirectory:
 * await fetchPublishedRepositoryContents(
 *   con,
 *   "Virtualization:vagrant",
 *   "openSUSE_Tumbleweed",
 *   { subdir: "src" }
 * );
 * // fetch the contents of the `aarch64/dist` directory:
 * await fetchPublishedRepositoryContents(
 *   con,
 *   "Virtualization:vagrant",
 *   "openSUSE_Tumbleweed",
 *   { arch: Arch.Aarch64, subdir: "dist" }
 * );
 *
 * // fetching "Virtualization:vagrant.repo" as the subdir will result in
 * // `undefined`, as this is actually a file
 * await fetchPublishedRepositoryContents(
 *   con,
 *   "Virtualization:vagrant",
 *   "openSUSE_Tumbleweed",
 *   { subdir: "Virtualization:vagrant.repo" }
 * );
 * ```
 */
export async function fetchPublishedRepositoryContents(
  con: Connection,
  project: ProjectName,
  repositoryName: string,
  { arch, subdir }: { arch?: Arch; subdir?: string } = {}
): Promise<(string | Arch)[] | undefined> {
  let route = `/published/${
    typeof project === "string" ? project : project.name
  }/${repositoryName}/`;
  route = route.concat(dropUndefined([arch, subdir]).join("/"));

  try {
    const binaryNames = await fetchDirectoryNames(con, route);
    return binaryNames;
  } catch (err) {
    if (isXmlParseError(err)) {
      return undefined;
    } else {
      throw err;
    }
  }
}

/**
 * Fetch a published file directly from the backend.
 * This function bypasses the repository redirector and downloads the file's
 * contents directly from the backend and should thus be used only
 * sparingly. Please use [[fetchDownloadUrls]] to create a direct URL instead
 * and fetch the contents from there.
 *
 * @param project  The name of the project from which the file should be fetched.
 * @param repositoryName  The name of the repository in which the file is published.
 * @param filename  Full name of the published file.
 * @param arch  Optional architecture in which subfolder the file is published.
 * @param subdir  Optional subdirectory name where the file is published
 *     (e.g. some files are published in a `isos` subdir)
 */
export async function fetchPublishedFile(
  con: Connection,
  project: ProjectName,
  repositoryName: string,
  filename: string,
  { arch, subdir }: { arch?: Arch; subdir?: string } = {}
): Promise<Buffer> {
  let route = `/published/${
    typeof project === "string" ? project : project.name
  }/${repositoryName}/`;
  route = route.concat(dropUndefined([arch, subdir]).join("/"), filename);
  const data = await con.makeApiCall(route, { decodeResponseFromXml: false });
  return data;
}

/**
 * Fetch download urls for the binaries in a published repository.
 * This function relies on the OBS' instances' [[Configuration.repositoryUrl]]
 * being set. If this value is unset, then an [[Error]] is thrown.
 *
 * @param project  The name of the project.
 * @param repositoryName  The name of the repository from which the binaries
 *     should be retrieved.
 *
 * @param arch  Architecture subdirectory from which the binaries should be
 *     retrieved (see [[fetchPublishedRepositoryContents]] for examples)
 * @param subdir  Subdirectory from which the binaries should be retrieved (see
 *     [[fetchPublishedRepositoryContents]] for examples)
 * @param conf  An optional already fetched [[Configuration]] object. If not
 *     supplied or if the [[Configuration.repositoryUrl]] parameter is
 *     undefined, then the configuration is fetched again.
 * @param binaries  An array of already known binaries that exist in the supplied
 *     repository + subdirs. This function then assumes that you only want urls
 *     for these binaries **and** are certain, that these binaries actually
 *     exist! The return value of this function then contains one url for each
 *     supplied binary.
 *     If this parameter is not present, then it fetches the existing binaries
 *     in the repository + subdir and constructs urls from that.
 *
 * @return An array of urls for all binaries present in the
 *     repository+arch+subdirectory combination (optionally restricted only to
 *     the binaries present in the `binaries` parameter).
 *     An empty array can either indicate an empty directory or that you
 *     accidentally supplied a file as the `subdir` parameter.
 */
export async function fetchDownloadUrls(
  con: Connection,
  project: ProjectName,
  repositoryName: string,
  {
    arch,
    subdir,
    conf,
    binaries
  }: {
    arch?: Arch;
    subdir?: string;
    conf?: Configuration;
    binaries?: string[];
  } = {}
): Promise<string[]> {
  const repositoryUrl =
    conf?.repositoryUrl ?? (await fetchConfiguration(con)).repositoryUrl;
  if (repositoryUrl === undefined) {
    throw new Error(
      `cannot construct download urls: build service instance ${con.url.href} does not provide downloadable binaries`
    );
  }

  const binary_names =
    binaries ??
    (await fetchPublishedRepositoryContents(con, project, repositoryName, {
      arch,
      subdir
    })) ??
    [];
  let baseRoute = `${repositoryUrl.href}/${
    typeof project === "string" ? project : project.name
  }/${repositoryName}/`;
  baseRoute = baseRoute.concat(dropUndefined([arch, subdir]).join("/"));

  return binary_names.map((b) =>
    baseRoute[baseRoute.length - 1] === "/"
      ? baseRoute.concat(b)
      : baseRoute.concat("/", b)
  );
}

async function createRepositoryConfigFromDod(
  con: Connection,
  projectName: string,
  repositoryName: string
): Promise<string | undefined> {
  const projMeta = await fetchProjectMeta(con, projectName);
  const matchingRepo = projMeta.repository?.find(
    (repo) => repo.name === repositoryName
  );
  if (
    matchingRepo === undefined ||
    matchingRepo.downloadOnDemand === undefined ||
    matchingRepo.downloadOnDemand.length === 0
  ) {
    return undefined;
  }
  const rpmMdRepos = dropUndefined(
    matchingRepo.downloadOnDemand.map((dod) =>
      dod.repositoryType === "rpmmd"
        ? `[${projectName}]
enabled=1
name=${projectName}
baseurl=${dod.url}
type=rpm-md
autorefresh=1
gpgcheck=1
`
        : undefined
    )
  );

  return rpmMdRepos.length > 0 ? rpmMdRepos.join("\n") : undefined;
}

/**
 * Fetch the contents of the .repo file that can be used by package managers
 * like zypper, dnf and yum to download packages from the published repository.
 *
 * This function will try to retrieve a published `.repo` file from the
 * backend. If this fails, it will fetch the projects' metadata and construct a
 * `.repo` file if the project has download on demand entries in its
 * repositories.
 *
 * **CAUTION:** This function only works for rpm-md repositories.
 *
 * @param project  The name of the project
 * @param repositoryName  The name of the repository for which the configuration
 *     should be fetched.
 *
 * @return The contents of the repository configuration file as retrieved from
 *     the backend if it exists. If the respective project & repository
 *     combination has no existing repository config, then undefined is
 *     returned.
 *     **WARNING:** Due to the way OBS' backend works, you'll also get
 *     `undefined` if the specified `project` has no repository with the
 *     supplied name instead of an exception!
 */
export async function fetchProjectsRpmRepositoryConfigFile(
  con: Connection,
  project: ProjectName,
  repositoryName: string
): Promise<string | undefined> {
  const projectName = typeof project === "string" ? project : project.name;

  const folderContents = await fetchPublishedRepositoryContents(
    con,
    projectName,
    repositoryName
  );

  if (folderContents === undefined || folderContents.length === 0) {
    return createRepositoryConfigFromDod(con, projectName, repositoryName);
  }

  const repoFile = folderContents.find(
    (f) => f.slice(f.length - 5) === ".repo"
  );

  if (repoFile !== undefined) {
    // we got a published .repo file => return that one
    const repo = await fetchPublishedFile(
      con,
      projectName,
      repositoryName,
      repoFile
    );
    return repo.toString();
  }
  return createRepositoryConfigFromDod(con, projectName, repositoryName);
}
