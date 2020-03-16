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

import * as assert from "assert";
import { Directory, fetchDirectory } from "./api/directory";
import { getPackageMeta, PackageMeta } from "./api/package-meta";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import {
  fetchFileContents,
  PackageFile,
  packageFileFromDirectoryEntry
} from "./file";
import { Project } from "./project";
import { zip } from "./util";

export interface Package {
  /** Name of this package */
  readonly name: string;

  /** The name of the project to which this package belongs */
  readonly projectName: string;

  /** md5 hash of the package contents */
  md5Hash?: string;

  /** The package's configuration (meta) */
  meta?: PackageMeta;

  /**
   * The files present in this package.
   *
   * If this field is undefined, then the file list has not been requested
   * yet. If it is an empty array, then no files are present.
   */
  files?: PackageFile[];
}

export async function fetchFileList(
  con: Connection,
  pkg: Package,
  {
    retrieveFileContents,
    expandLinks,
    revision
  }: {
    retrieveFileContents?: boolean;
    expandLinks?: boolean;
    revision?: string;
  } = {}
): Promise<[PackageFile[], string]> {
  const directoryBaseRoute = `/source/${pkg.projectName}/${pkg.name}?expand=`.concat(
    expandLinks === undefined || expandLinks ? "1" : "0"
  );
  const route =
    revision !== undefined
      ? directoryBaseRoute.concat(`&rev=${revision}`)
      : directoryBaseRoute;
  const fileDir = await fetchDirectory(con, route);

  if (fileDir.sourceMd5 === undefined) {
    throw new Error(
      `File content listing of the package ${pkg.projectName}/${pkg.name} has no md5 hash defined`
    );
  }

  const files = extractFileListFromDirectory(pkg, fileDir);

  if (retrieveFileContents !== undefined && retrieveFileContents) {
    await Promise.all(
      files.map(async f => {
        f.contents = await fetchFileContents(con, f, revision);
      })
    );
  }
  return [files, fileDir.sourceMd5];
}

// FIXME: this should maybe not be exported
export function extractFileListFromDirectory(
  pkg: Package,
  fileDir: Directory
): PackageFile[] {
  if (
    fileDir.directoryEntries === undefined ||
    fileDir.directoryEntries.length === 0
  ) {
    return [];
  }

  const files: PackageFile[] = fileDir.directoryEntries
    .filter(dentry => dentry.name !== undefined)
    .map(dentry => {
      return {
        name: dentry.name!,
        projectName: pkg.projectName,
        packageName: pkg.name
      };
    });

  return zip(fileDir.directoryEntries, files).map(([dentry, pkgFile]) =>
    packageFileFromDirectoryEntry(pkgFile, dentry)
  );
}

/**
 * Fetch the information about package from OBS and populate a [[Package]]
 * object with the retrieved data.
 *
 * @param con  Connection to be used for the API calls
 * @param project  Either the name of the project or a [[Project]] object to
 *     which the package belongs
 * @param packageName  Name of the package that should be retrieved
 *
 * @param retrieveFileContents  Flag whether the file contents at the latest
 *     revision should be fetched too. Defaults to `false`.
 * @param expandLinks  If a package is a link, check out the expanded
 *     sources. Defaults to `true`.
 */
export async function fetchPackage(
  con: Connection,
  project: Project | string,
  packageName: string,
  {
    retrieveFileContents,
    expandLinks
  }: {
    retrieveFileContents?: boolean;
    expandLinks?: boolean;
  } = {}
): Promise<Package> {
  const projName: string = typeof project === "string" ? project : project.name;

  const pkg: Package = {
    name: packageName,
    projectName: projName,
    files: []
  };

  const [filesAndHash, pkgMeta] = await Promise.all([
    fetchFileList(con, pkg, {
      retrieveFileContents,
      expandLinks
    }),
    getPackageMeta(con, projName, packageName)
  ]);

  [pkg.files, pkg.md5Hash, pkg.meta] = [
    filesAndHash[0],
    filesAndHash[1],
    pkgMeta
  ];

  return pkg;
}

/**
 * Deletes the package belonging to the project `projName` and with the name
 * `packageName`.
 */
export async function deletePackage(
  con: Connection,
  projName: string,
  packageName: string
): Promise<StatusReply>;

/**
 * Deletes the [[Package]] `pkg`.
 */
export async function deletePackage(
  con: Connection,
  pkg: Package
): Promise<StatusReply>;

export async function deletePackage(
  con: Connection,
  projNameOrPkg: string | Package,
  packageName?: string
): Promise<StatusReply> {
  assert(typeof projNameOrPkg === "string" && packageName !== undefined);
  const route =
    typeof projNameOrPkg === "string"
      ? `/source/${projNameOrPkg}/${packageName}`
      : `/source/${projNameOrPkg.projectName}/${projNameOrPkg.name}`;
  const response = await con.makeApiCall(route, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(response);
}
