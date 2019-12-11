import * as assert from "assert";
import { DirectoryEntry } from "./api/directory";
import { Connection } from "./connection";
import { fetchRevisions, Revision } from "./revision";
import { dateFromUnixTimeStamp, deleteUndefinedMembers } from "./util";

export interface PackageFile {
  name: string;
  packageName: string;
  projectName: string;
  contents?: string;
  md5Hash?: string;
  size?: number;
  modifiedTime?: Date;
}

export function fillPackageFileFromDirectoryEntry(
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

export async function fetchFileHistory(
  con: Connection,
  file: PackageFile,
  revisions?: Revision[]
): Promise<string[]> {
  const hist =
    revisions ??
    (await fetchRevisions(con, file.projectName, file.packageName));

  return Promise.all(hist.map(rev => fetchFileContents(con, file, rev)));
}

export function fetchFileContents(
  con: Connection,
  pkgFile: PackageFile,
  revision?: Revision
): Promise<string> {
  const baseRoute = `/source/${pkgFile.projectName}/${pkgFile.packageName}/${pkgFile.name}`;
  const route =
    revision === undefined
      ? baseRoute
      : `${baseRoute}?rev=${revision.revision}`;
  return con.makeApiCall(route, { decodeReply: false });
}
