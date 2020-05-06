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
import { promises as fsPromises } from "fs";
import { basename } from "path";
import { DirectoryEntry } from "./api/directory";
import { calculateHash } from "./checksum";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import { Commit } from "./history";
import { Package } from "./package";
import { deleteUndefinedMembers, pathExists, PathType } from "./util";

export interface PackageFile {
  name: string;
  packageName: string;
  projectName: string;
  /** The contents of this file. */
  contents?: Buffer;
  md5Hash?: string;
  size?: number;
  modifiedTime?: Date;
}

export async function packagFileFromFile(
  path: string,
  pkg: Package
): Promise<PackageFile>;

export async function packagFileFromFile(
  path: string,
  packageName: string,
  projectName: string
): Promise<PackageFile>;

/** Create a [[PackageFile]] from an existing file on the file system */
export async function packagFileFromFile(
  path: string,
  packageOrPackageName: string | Package,
  project?: string
): Promise<PackageFile> {
  if (!(await pathExists(path, PathType.File))) {
    throw new Error(`${path} is not a file or does not exist`);
  }

  if (typeof packageOrPackageName === "string") {
    assert(
      project !== undefined,
      "projectName must not be undefined when using the packageName, projectName overload"
    );
  }

  const [packageName, projectName] =
    typeof packageOrPackageName === "string"
      ? [packageOrPackageName, project!]
      : [packageOrPackageName.name, packageOrPackageName.projectName];

  const [stat, contents] = await Promise.all([
    fsPromises.stat(path),
    fsPromises.readFile(path)
  ]);

  // as OBS uses time stamps with 1s precision, we must truncate the ms part of
  // the mtime to get consistent results (see catches_and_warnings.md)
  stat.mtime.setMilliseconds(0);
  await fsPromises.utimes(path, stat.atime, stat.mtime);

  return Object.freeze({
    name: basename(path),
    packageName,
    projectName,
    size: stat.size,
    contents,
    md5Hash: calculateHash(contents, "md5"),
    modifiedTime: stat.mtime
  });
}

export function packageFileFromDirectoryEntry(
  file: PackageFile,
  dentry: DirectoryEntry
): PackageFile {
  if (dentry.name === undefined) {
    throw new Error(
      "Cannot create a PackageFile from the DirectoryEntry: the directory name is undefined"
    );
  }
  assert(
    file.name === dentry.name,
    `file name (${file.name}) and directory name (${dentry.name}) do not match`
  );
  return deleteUndefinedMembers({
    name: dentry.name,
    packageName: file.packageName,
    projectName: file.projectName,
    md5Hash: dentry.md5,
    modifiedTime: dentry.modifiedTime,
    size: dentry.size !== undefined ? dentry.size : file.contents?.length,
    contents: file.contents
  });
}

/**
 * Retrieve the contents of the specified file.
 *
 * @param con  The [[Connection]] that will be used for API calls.
 * @param pkgFile  The file which contents should be retrieved.
 * @param expandLinks  Whether package links should be expanded (defaults to
 *     `true`).
 *     It is generally recommended to always expand links, as that is the
 *     content that is used in the end by OBS. Note that for packages that are
 *     pure links (i.e. just a `_link` file), will have no other files present
 *     and thus fetching their contents requires `expandLinks = true`.
 * @param revision  If provided, then the package contents will be fetched at
 *     the specified revision. Otherwise they will be fetched from the HEAD
 *     commit.
 *     Possible values for this parameter are:
 *     - the revision number
 *     - the md5 hash of the revision
 *     - a [[Commit]] object
 *
 * @return A `Buffer` with the contents of `pkgFile`.
 */
export function fetchFileContents(
  con: Connection,
  pkgFile: PackageFile,
  {
    expandLinks,
    revision
  }: {
    expandLinks?: boolean;
    revision?: Commit | string | number;
  } = {}
): Promise<Buffer> {
  if (expandLinks === undefined) {
    expandLinks = true;
  }
  let route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${
    pkgFile.name
  }?expand=${expandLinks ? 1 : 0}`;

  if (revision !== undefined) {
    const rev =
      typeof revision === "string"
        ? revision
        : typeof revision === "number"
        ? revision.toString()
        : revision.revisionHash;
    route = route.concat(`&rev=${rev}`);
  }

  return con.makeApiCall(route, { decodeResponseFromXml: false });
}

/**
 * Upload the file contents of the provided file to OBS.
 *
 * @param con  The [[Connection]] to use for the upload.
 * @param pkgFile  The file which' contents should be uploaded.
 *     The [[packageFile.contents]] field must not be undefined, otherwise an
 *     exception is thrown.
 *
 * @return The status as reported by OBS on success.
 *
 * @throw An [[ApiError]] when the communication with OBS fails or an `Error` if
 *     the package's file contents are undefined.
 */
export async function uploadFileContents(
  con: Connection,
  pkgFile: PackageFile
): Promise<string> {
  if (pkgFile.contents === undefined) {
    throw new Error(
      `File ${pkgFile.name} from the package ${pkgFile.packageName} and project ${pkgFile.projectName} has no file contents.`
    );
  }

  const route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}?rev=repository`;

  const response = await con.makeApiCall(route, {
    method: RequestMethod.PUT,
    payload: pkgFile.contents,
    sendPayloadAsRaw: true
  });

  // FIXME:
  return response.revision?.srcmd5;
  // return statusReplyFromApi(response);
}

/**
 * Deletes the specified file from its package on OBS and commits the changes.
 */
export async function deleteFile(
  con: Connection,
  pkgFile: PackageFile
): Promise<StatusReply> {
  const route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}`;

  return statusReplyFromApi(
    await con.makeApiCall(route, { method: RequestMethod.DELETE })
  );
}
