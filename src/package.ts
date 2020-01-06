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
import { getDirectory } from "./api/directory";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import {
  fetchFileContents,
  fillPackageFileFromDirectoryEntry,
  PackageFile
} from "./file";
import { fetchRevisions, Revision } from "./revision";
import { zip } from "./util";

export interface Package {
  readonly name: string;
  readonly project: string;
  files?: PackageFile[];
  history?: ReadonlyArray<[Revision, ReadonlyArray<PackageFile> | undefined]>;
}

export enum HistoryFetchType {
  /** Don't fetch the history of the package */
  NoHistory,

  /** Fetch the revision list (= commit history) only */
  RevisionsOnly,

  /** Fetch the revision list and the file list at each revision */
  RevisionsAndFiles,

  /**
   * Fetch the revision list, the file list at each revision and the file
   * contents at each revision
   */
  RevisionsAndFileContents
}

async function fetchFileList(
  con: Connection,
  pkg: Package,
  retrieveFileContents: boolean,
  revision?: Revision
): Promise<PackageFile[]> {
  const baseRoute = `/source/${pkg.project}/${pkg.name}`;
  const route =
    revision === undefined
      ? baseRoute
      : `${baseRoute}?rev=${revision.revision}`;

  const fileDir = await getDirectory(con, route);
  assert(
    revision?.revision !== undefined && fileDir.revision !== undefined
      ? parseInt(fileDir.revision, 10) === revision.revision
      : true,
    `Expected to receive version ${revision?.revision} but got ${fileDir.revision} back`
  );

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
        projectName: pkg.project,
        packageName: pkg.name
      };
    });

  if (retrieveFileContents) {
    await Promise.all(
      files.map(async f => {
        f.contents = await fetchFileContents(con, f, revision);
      })
    );
  }

  return zip(fileDir.directoryEntries, files).map(([dentry, pkgFile]) =>
    fillPackageFileFromDirectoryEntry(pkgFile, dentry)
  );
}

export async function fetchPackage(
  con: Connection,
  projectName: string,
  packageName: string,
  {
    historyFetchType,
    pkgContents
  }: {
    historyFetchType?: HistoryFetchType;
    pkgContents?: boolean;
  } = {}
): Promise<Package> {
  const fetchType: HistoryFetchType =
    historyFetchType === undefined
      ? HistoryFetchType.RevisionsOnly
      : historyFetchType;

  const pkg: Package = { name: packageName, project: projectName };

  pkg.files = await fetchFileList(
    con,
    pkg,
    pkgContents === undefined ? true : pkgContents
  );

  if (fetchType === HistoryFetchType.NoHistory) {
    return pkg;
  }

  const hist = await fetchRevisions(con, projectName, packageName);

  const revisionsAndFiles: Array<[
    Revision,
    readonly PackageFile[] | undefined
  ]> = hist.map(rev => [rev, undefined]);

  if (fetchType === HistoryFetchType.RevisionsOnly) {
    pkg.history = revisionsAndFiles;
    return pkg;
  }

  await Promise.all(
    revisionsAndFiles.map(
      async (_, i: number): Promise<void> => {
        const fileList = await fetchFileList(
          con,
          pkg,
          fetchType === HistoryFetchType.RevisionsAndFileContents,
          revisionsAndFiles[i][0]
        );
        revisionsAndFiles[i][1] = Object.freeze(fileList);
      }
    )
  );
  pkg.history = revisionsAndFiles;

  return pkg;
}

export async function deletePackage(
  con: Connection,
  pkg: Package
): Promise<StatusReply> {
  const response = await con.makeApiCall(`/source/${pkg.project}/${pkg.name}`, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(response);
}
