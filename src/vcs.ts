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

import * as assert from "assert";
import { promises as fsPromises } from "fs";
import { join } from "path";
import {
  Directory,
  DirectoryEntry,
  directoryFromApi,
  directoryToApi
} from "./api/directory";
import { calculateFileHash, calculateHash } from "./checksum";
import { Connection, RequestMethod } from "./connection";
import { PackageFile, packagFileFromFile, uploadFileContents } from "./file";
import {
  Package,
  readInCheckedOutPackage,
  writePackageUnderscoreFiles
} from "./package";
import { setIntersection } from "./set-utils";
import { pathExists, PathType } from "./util";

/** State of a File that is (potentially) under version control */
export const enum FileState {
  /** tracked and unmodified */
  Unmodified = "unmodified",
  /** file has a difference w.r.t. HEAD */
  Modified = "modified",
  /** file is to be deleted on the next commit */
  ToBeDeleted = "to_be_deleted",
  /** file is untracked and should be added on the next commit */
  ToBeAdded = "to_be_added",
  /** file is untracked */
  Untracked = "untracked",
  /** file is tracked but is missing from the repository */
  Missing = "missing"
}

function isTrackedFile(file: VcsFile): boolean {
  return (
    file.state === FileState.Unmodified ||
    file.state === FileState.Modified ||
    file.state === FileState.Missing
  );
}

export interface VcsFile extends PackageFile {
  state: FileState;
}

export interface ModifiedPackage extends Omit<Package, "files"> {
  /** Path to the directory containing the checked out Package */
  readonly path: string;

  /**
   * Files that are or were in the directory where the package has been checked
   * out.
   */
  readonly files: VcsFile[];

  /** Files that have been modified from the state at HEAD */
  // readonly dirtyFiles: PackageFile[];

  /**
   * Files in the directory that should be added to the package on the next
   * commit.
   */
  // readonly filesToBeAdded: PackageFile[];

  /** Files that should be deleted from the package on the next commit */
  // readonly filesToBeDeleted: PackageFile[];

  /**
   * Files in the directory that are not tracked (= neither a part of the
   * package nor should they become a part of it)
   */
  // readonly untrackedFiles: string[];

  /**
   * Files that were not explicitly deleted but that are no longer in the
   * directory
   */
  // readonly missingFiles: string[];
}

// function ModifiedPkgFromPkg(pkg: Package): ModifiedPackage {
// }

const enum FileListType {
  ToBeAdded = "_to_be_added",
  ToBeDeleted = "_to_be_deleted"
}

/**
 * Retrieve the list of files to be added or removed from the `.osc`
 * subdirectory of `directory`.
 *
 * This function does not explicitly check for the existence of the `.osc`
 * subdirectory, the caller should ensure that it exists. Otherwise this
 * function will return an empty array.
 */
async function readFileListFromDir(
  directory: string,
  fileListType: FileListType
): Promise<string[]> {
  const targetFile = join(directory, ".osc", fileListType);
  if (!(await pathExists(targetFile, PathType.File))) {
    return [];
  }

  return (await fsPromises.readFile(targetFile)).toString().split(`
`);
}

export async function addAndDeleteFilesFromPackage(
  pkg: ModifiedPackage,
  filesToDelete: string[],
  filesToAdd: string[]
): Promise<ModifiedPackage> {
  const toAddAndDelete = setIntersection(
    new Set(filesToDelete),
    new Set(filesToAdd)
  );
  if (toAddAndDelete.size > 0) {
    throw new Error(
      `Cannot add *and* remove the files: ${[...toAddAndDelete.entries()].join(
        ", "
      )}.`
    );
  }

  const { files, ...restOfPkg } = pkg;

  // cannot add files that are not untracked (= they don't exist or they are in
  // a different state)
  filesToAdd.forEach((toAddFname) => {
    if (
      files.find(
        (f) => toAddFname === f.name && f.state === FileState.Untracked
      ) === undefined
    ) {
      throw new Error(`Cannot add file ${toAddFname}, it is not untracked`);
    }
  });

  // can only remove files that are tracked
  filesToDelete.forEach((toDeleteFname) => {
    if (
      files.find((f) => f.name === toDeleteFname && isTrackedFile(f)) ===
      undefined
    ) {
      throw new Error(`Cannot remove ${toDeleteFname}: not tracked`);
    }
  });

  const newFiles: VcsFile[] = [];

  for (const oldFile of files) {
    let { state, ...restOfFile } = oldFile;

    // contents of files to be added need to be read so that we can commit them later on
    if (filesToAdd.find((fname) => fname === oldFile.name) !== undefined) {
      assert(
        state === FileState.Untracked,
        `File ${oldFile.name} must be untracked, but it has the state: ${state}`
      );
      state = FileState.ToBeAdded;
      restOfFile = await packagFileFromFile(join(pkg.path, oldFile.name), pkg);
    }

    if (filesToDelete.find((fname) => fname === oldFile.name) !== undefined) {
      assert(
        isTrackedFile(oldFile),
        `File ${oldFile.name} must be tracked, but it has the state: ${state}`
      );
      state = FileState.ToBeDeleted;
    }
    newFiles.push({ state, ...restOfFile });
  }

  await Promise.all(
    [
      {
        fileList: newFiles.filter((f) => f.state === FileState.ToBeDeleted),
        dest: FileListType.ToBeDeleted
      },
      {
        fileList: newFiles.filter((f) => f.state === FileState.ToBeAdded),
        dest: FileListType.ToBeAdded
      }
    ].map(async ({ fileList, dest }) =>
      fsPromises.writeFile(
        join(pkg.path, ".osc", dest),
        fileList.map((f) => f.name).join(`
`)
      )
    )
  );

  await Promise.all(
    filesToDelete.map((fname) => fsPromises.unlink(join(pkg.path, fname)))
  );

  return { files: newFiles, ...restOfPkg };
}

export async function readInModifiedPackageFromDir(
  dir: string
): Promise<ModifiedPackage> {
  const pkg = await readInCheckedOutPackage(dir);
  assert(
    pkg.files !== undefined,
    "readInCheckedOutPackage must populate the file list, but it did not"
  );
  assert(
    pkg.files!.reduce(
      (accum, curVal) => accum && curVal.md5Hash !== undefined,
      true
    ),
    "readInCheckedOutPackage must set the md5 sum of all files, but it didn't"
  );

  const [toBeAdded, toBeDeleted] = await Promise.all([
    readFileListFromDir(dir, FileListType.ToBeAdded),
    readFileListFromDir(dir, FileListType.ToBeDeleted)
  ]);

  const filesAtHead = pkg.files!;
  const files: VcsFile[] = [];
  let notSeenFiles = filesAtHead.map((f) => f.name);

  const dentries = await fsPromises.readdir(dir, { withFileTypes: true });

  await Promise.all(
    dentries.map(async (dentry) => {
      if (dentry.isFile()) {
        const filePath = join(dir, dentry.name);
        const curFileMd5Hash = await calculateFileHash(filePath, "md5");

        assert(
          curFileMd5Hash !== undefined,
          `md5Hash must not be undefined, as the file ${filePath} exists`
        );

        const matchingPkgFile = filesAtHead.find((f) => f.name === dentry.name);
        if (matchingPkgFile === undefined) {
          // the current file is not tracked
          // either it is already registered as to be added (then we don't )or it is really
          // untracked
          const common = {
            name: dentry.name,
            packageName: pkg.name,
            projectName: pkg.projectName,
            md5Hash: curFileMd5Hash
          };
          const state =
            toBeAdded.find((fname) => fname === dentry.name) !== undefined
              ? FileState.ToBeAdded
              : FileState.Untracked;

          files.push({ ...common, state });
        } else {
          // file is tracked => drop it from the list of seen files
          notSeenFiles = notSeenFiles.filter((fname) => fname !== dentry.name);

          assert(matchingPkgFile.md5Hash !== undefined);

          const state =
            curFileMd5Hash !== matchingPkgFile.md5Hash
              ? FileState.Modified
              : FileState.Unmodified;

          const { contents, md5Hash, ...rest } = matchingPkgFile;
          files.push({
            state,
            contents:
              state === FileState.Modified
                ? await fsPromises.readFile(filePath)
                : contents,
            md5Hash: curFileMd5Hash,
            ...rest
          });
        }
      }
    })
  );

  // all files that we haven't seen and that aren't to be deleted have to be marked as missing
  notSeenFiles
    .filter(
      (notSeenFileName) =>
        toBeDeleted.find((fname) => fname === notSeenFileName) === undefined
    )
    .forEach((name) => {
      files.push({
        name,
        packageName: pkg.name,
        projectName: pkg.projectName,
        state: FileState.Missing
      });
    });

  const { files: ignored, ...restOfPkg } = pkg;

  return {
    ...restOfPkg,
    files,
    path: dir
  };
}

function directoryFromModifiedPackage(pkg: ModifiedPackage): Directory {
  const dentries: DirectoryEntry[] = pkg.files
    .filter((f) => f.state !== FileState.Untracked)
    .map((f) => ({
      name: f.name,
      size: f.size,
      md5: f.md5Hash,
      modifiedTime: f.modifiedTime,
      hash: {
        hashFunction: "sha256",
        hash: calculateHash(f.contents!, "sha256")
      }
    }));
  return { directoryEntries: dentries };
}

// FIXME: this function should preferably return a Commit? Or maybe a modifiedPackage? or a new Package?
export async function commit(
  con: Connection,
  pkg: ModifiedPackage,
  commitMessage?: string
): Promise<ModifiedPackage> {
  await Promise.all(
    pkg.files.map(async (f) => {
      if (f.state === FileState.Modified || f.state === FileState.ToBeAdded) {
        await uploadFileContents(con, f);
      }
    })
  );

  const baseRoute = `/source/${pkg.projectName}/${pkg.name}?cmd=commitfilelist&withvalidate=1`;
  const route =
    commitMessage === undefined
      ? baseRoute
      : baseRoute.concat(`&comment=${commitMessage}`);
  const newDirectoryApiReply = await con.makeApiCall(route, {
    method: RequestMethod.POST,
    payload: directoryToApi(directoryFromModifiedPackage(pkg))
  });

  const newDir = directoryFromApi(newDirectoryApiReply);
  assert(
    newDir.name === pkg.name,
    `Invalid reply received from OBS: replied package as a different name, expected ${pkg.name} but got ${newDir.name}`
  );

  const { files, md5Hash, ...restOfPkg } = pkg;
  const newPkg = {
    // If the package is a link, then we'll get a <linkinfo> in the reply from
    // OBS which *should* contain a xsrcmd5 element containing the md5Hash of
    // the expanded sources (the value that we're after).
    // If this value is undefined (= doesn't exist), then we'll use the
    // sourceMd5 that we get from OBS.
    md5Hash:
      (newDir.linkInfos !== undefined && newDir.linkInfos.length > 0
        ? newDir.linkInfos[0].xsrcmd5
        : undefined) ?? newDir.sourceMd5,
    files: files
      .filter((f) => f.state !== FileState.ToBeDeleted)
      .map(({ state, ...restOfFile }) => ({
        state: state === FileState.ToBeAdded ? FileState.Unmodified : state,
        ...restOfFile
      })),
    ...restOfPkg
  };

  await writePackageUnderscoreFiles(newPkg, newPkg.path);
  return newPkg;
}
