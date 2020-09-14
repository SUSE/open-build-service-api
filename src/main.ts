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

export { Account, addAccountToOscrc, readAccountsFromOscrc } from "./account";
export { Arch, BaseRepository, Path } from "./api/base-types";
export * from "./api/project-meta";
export * from "./configuration";
export { Connection, normalizeUrl } from "./connection";
export { Distribution, fetchHostedDistributions } from "./distributions";
export * from "./file";
export {
  Commit,
  drawHistoryToSvg,
  fetchFileContentsAtCommit,
  fetchHistory,
  fetchHistoryAcrossLinks,
  Revision
} from "./history";
export {
  branchPackage,
  checkOutPackage,
  createPackage,
  deletePackage,
  fetchPackage,
  Package
} from "./package";
export * from "./project";
export {
  fetchRequest,
  fetchRequestDiff,
  requestDeletion,
  submitPackage
} from "./request";
export { Group, GroupWithRole, User, UserWithRole } from "./user";
export {
  pathExists,
  PathType,
  ProcessError,
  rmRf,
  runProcess,
  zip
} from "./util";
export {
  addAndDeleteFilesFromPackage,
  commit,
  FileState,
  ModifiedPackage,
  readInModifiedPackageFromDir,
  untrackFiles,
  VcsFile
} from "./vcs";
