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
import { DirectoryEntry } from "./api/directory";
import { Connection } from "./connection";
import { Commit } from "./history";
import { dateFromUnixTimeStamp, deleteUndefinedMembers } from "./util";

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
    modifiedTime:
      dentry.mtime === undefined
        ? undefined
        : dateFromUnixTimeStamp(dentry.mtime),
    size: dentry.size === undefined ? undefined : parseInt(dentry.size, 10),
    contents: file.contents
  });
}

/**
 * Retrieve the contents of the specified `pkgFile`.
 *
 * @param revision  If provided, then the package contents will be fetched at
 *     the specified revision. Otherwise they will be fetched from the HEAD
 *     commit.
 *     Possible values for this parameter are:
 *     - the revision number
 *     - the md5 hash of the revision
 *     - a [[Commit]] object
 */
export function fetchFileContents(
  con: Connection,
  pkgFile: PackageFile,
  revision?: Commit | string | number
): Promise<Buffer> {
  let route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}`;

  if (revision !== undefined) {
    const rev =
      typeof revision === "string"
        ? revision
        : typeof revision === "number"
        ? revision.toString()
        : revision.revisionHash;
    route = route.concat(`?rev=${rev}`);
  }

  return con.makeApiCall(route, { decodeResponse: DecodeResponse.AS_BUFFER });
}
