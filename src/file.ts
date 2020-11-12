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
import { StatusReply, statusReplyFromApi, StatusReplyApiReply } from "./error";
import {
  apiRevisionToRevision,
  Commit,
  Revision,
  RevisionApiReply
} from "./history";
import { Package } from "./package";
import { withoutUndefinedMembers, pathExists, PathType } from "./util";

export interface PackageFile {
  readonly name: string;
  readonly packageName: string;
  readonly projectName: string;
  /** The contents of this file. */
  contents?: Buffer;
  md5Hash?: string;
  size?: number;
  modifiedTime?: Date;
}

/** Good lord what a terrible name :-/ */
type FrozenPackageFileWithOptionalContents = Readonly<
  Required<Omit<PackageFile, "contents">>
> & { contents?: Buffer };

export type FrozenPackageFile = Readonly<Required<PackageFile>>;

export function isFrozenPackageFile(
  file: PackageFile
): file is FrozenPackageFile {
  return (
    file.contents !== undefined &&
    file.md5Hash !== undefined &&
    file.size !== undefined &&
    file.modifiedTime !== undefined &&
    Object.isFrozen(file)
  );
}

/**
 * Creates a new FrozenPackageFile from a string or a `Buffer`.
 *
 * @param fileName  The name of the file.
 * @param contents  The file's contents. The file size and hash is calculated
 *     from the contents.
 * @param modifiedTime  An optional modification time. Defaults to now.
 */
export function packageFileFromBuffer(
  fileName: string,
  packageName: string,
  projectName: string,
  contents: Buffer | string,
  modifiedTime?: Date
): FrozenPackageFile {
  const contBuf =
    typeof contents === "string" ? Buffer.from(contents) : contents;
  return Object.freeze({
    name: fileName,
    packageName,
    projectName,
    contents: contBuf,
    size: contBuf.length,
    md5Hash: calculateHash(contBuf, "md5"),
    modifiedTime:
      modifiedTime ??
      (() => {
        const now = new Date();
        now.setMilliseconds(0);
        return now;
      })()
  });
}

export async function packageFileFromFile(
  path: string,
  pkg: Package
): Promise<FrozenPackageFile>;

export async function packageFileFromFile(
  path: string,
  packageName: string,
  projectName: string
): Promise<FrozenPackageFile>;

/** Create a [[PackageFile]] from an existing file on the file system */
export async function packageFileFromFile(
  path: string,
  packageOrPackageName: string | Package,
  project?: string
): Promise<FrozenPackageFile> {
  if ((await pathExists(path, PathType.File)) === undefined) {
    throw new Error(`${path} is not a file or does not exist`);
  }

  if (typeof packageOrPackageName === "string") {
    assert(
      project !== undefined,
      "projectName must not be undefined when using the (packageName, projectName) overload"
    );
  }

  const [packageName, projectName] =
    typeof packageOrPackageName === "string"
      ? [packageOrPackageName, project]
      : [packageOrPackageName.name, packageOrPackageName.projectName];
  assert(projectName !== undefined);

  const [stat, contents] = await Promise.all([
    fsPromises.stat(path),
    fsPromises.readFile(path)
  ]);

  // as OBS uses time stamps with 1s precision, we must truncate the ms part of
  // the mtime to get consistent results (see catches_and_warnings.md)
  stat.mtime.setMilliseconds(0);
  await fsPromises.utimes(path, stat.atime, stat.mtime);

  return packageFileFromBuffer(
    basename(path),
    packageName,
    projectName,
    contents,
    stat.mtime
  );
}

export function packageFileFromDirectoryEntry(
  file: PackageFile,
  dentry: DirectoryEntry
): FrozenPackageFileWithOptionalContents {
  const md5Hash =
    dentry.md5 ??
    file.md5Hash ??
    (file.contents !== undefined
      ? calculateHash(file.contents, "md5")
      : undefined);
  const modifiedTime = dentry.modifiedTime ?? file.modifiedTime;
  const size = dentry.size ?? file.size ?? file.contents?.length;

  if (file.name !== dentry.name) {
    throw new Error(
      `file name (${file.name}) and directory name (${
        dentry.name ?? "undefined"
      }) do not match`
    );
  }
  [
    [md5Hash, "md5Hash"],
    [modifiedTime, "modifiedTime"],
    [size, "size"]
  ].forEach(([value, name]) => {
    if (value === undefined) {
      throw new Error(
        `Invalid directory or package: could not obtain ${
          name?.toString() ?? "undefined"
        }`
      );
    }
  });

  assert(
    md5Hash !== undefined && modifiedTime !== undefined && size !== undefined
  );

  return withoutUndefinedMembers({
    name: dentry.name,
    packageName: file.packageName,
    projectName: file.projectName,
    md5Hash: md5Hash,
    modifiedTime: modifiedTime,
    size: size,
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
 * Set the contents of the file `pkgFile` and commit them, with the optionally
 * supplied commit message.
 *
 * @param con  The [[Connection]] used for the API calls.
 * @param pkgFile  The file which' contents will be set to `pkgFile.contents`.
 * @param commitMsg  An optional commit message that will be added to the
 *     commit.
 *
 * @return The created [[Revision]] (= commit) by this operation.
 */
export async function setFileContentsAndCommit(
  con: Connection,
  pkgFile: FrozenPackageFile,
  commitMsg?: string
): Promise<Revision> {
  const route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}`;
  const revisionApiReply = await con.makeApiCall<{
    revision: RevisionApiReply;
  }>(commitMsg === undefined ? route : `${route}?comment=${commitMsg}`, {
    method: RequestMethod.PUT,
    payload: pkgFile.contents,
    sendPayloadAsRaw: true
  });

  return apiRevisionToRevision(revisionApiReply.revision, {
    projectName: pkgFile.projectName,
    name: pkgFile.packageName
  });
}

/**
 * Upload the file contents of the provided file to OBS.
 *
 * @param con  The [[Connection]] to use for the upload.
 * @param pkgFile  The file which' contents should be uploaded.
 *     The [[packageFile.contents]] field must not be undefined, otherwise an
 *     exception is thrown.
 *
 * @return nothing
 *
 * @throw  An [[ApiError]] when the communication with OBS fails or an `Error`
 *     when an invalid reply is received from OBS.
 */
export async function uploadFileContents(
  con: Connection,
  pkgFile: FrozenPackageFile
): Promise<void> {
  const route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}?rev=repository`;

  // OBS always returns the following xml object back:
  // <revision rev="repository">
  //   <srcmd5>d41d8cd98f00b204e9800998ecf8427e</srcmd5>
  // </revision>
  // according to:
  // https://github.com/openSUSE/open-build-service/issues/9706#issuecomment-641476410
  // this is expected as that is the srcmd5 of the empty file set (= echo -n | md5sum).
  // This is of course absolutely useless and there is no point in returning
  // that. We check the result, but at some point this weird behavior might get
  // changed and will only break working code.
  await con.makeApiCall(route, {
    method: RequestMethod.PUT,
    payload: pkgFile.contents,
    sendPayloadAsRaw: true
  });
}

/**
 * Deletes the specified file from its package on OBS and commits the changes.
 *
 * Note: this is usually **not** the thing that you want to do, as this will
 * create a single commit just deleting the file. In case you want to delete a
 * file as part of a commit use [[addAndDeleteFilesFromPackage]].
 */
export async function deleteFile(
  con: Connection,
  pkgFile: PackageFile
): Promise<StatusReply> {
  const route = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}`;

  return statusReplyFromApi(
    await con.makeApiCall<StatusReplyApiReply>(route, {
      method: RequestMethod.DELETE
    })
  );
}
