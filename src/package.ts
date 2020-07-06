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
import { join } from "path";
import {
  Directory,
  directoryFromApi,
  directoryToApi,
  fetchDirectory
} from "./api/directory";
import {
  getPackageMeta,
  PackageMeta,
  packageMetaFromApi,
  packageMetaToApi,
  setPackageMeta
} from "./api/package-meta";
import { calculateHash } from "./checksum";
import { Connection, normalizeUrl, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import {
  fetchFileContents,
  FrozenPackageFile,
  isFrozenPackageFile,
  PackageFile,
  packageFileFromDirectoryEntry
} from "./file";
import { Project } from "./project";
import { createOrEnsureEmptyDir, unixTimeStampFromDate, zip } from "./util";
import { FileState, ModifiedPackage } from "./vcs";
import { newXmlBuilder, newXmlParser } from "./xml";

export interface Package {
  /** Url to the API from which this package was retrieved */
  readonly apiUrl: string;

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

type PackageWithRequiredFiles = Omit<Package, "files"> & {
  files: FrozenPackageFile[];
};

export interface FrozenPackage
  extends Readonly<Required<Omit<Package, "meta" | "files">>> {
  /** The files present in this package at HEAD. */
  readonly files: FrozenPackageFile[];

  /** The package's configuration (meta) */
  meta?: PackageMeta;
}

/** Package populated metadata */
export type PackageWithMeta = Omit<FrozenPackage, "files"> & {
  files: PackageFile[];
};

export interface FetchFileListBaseOptions {
  /** Defines if package links should be expanded, defaults to true */
  expandLinks?: boolean;

  /**
   * Flag telling OBS how links should be expanded (`false` by default).
   *
   * By default OBS will use the HEAD of the package to which the link points
   * and the current revision of the package with the link file to perform the
   * 3-way merge for link expansion. This has the disadvantage that packages
   * with links do not have a stable history. This can be circumvented by
   * telling OBS to use the `baserev` from the `_link` file for link expansion
   * instead of the HEAD of the package.
   *
   * In most cases you **don't** want to set this to true, because it can break
   * packages that have been branched.
   */
  linkedRevisionIsBase?: boolean;

  /**
   * If a different revision than HEAD should be fetched, specify a valid
   * identifier for it (numeric id or md5 hash).
   */
  revision?: string;
}

function isPackage(pkg: any): pkg is Package {
  for (const prop of ["name", "apiUrl", "projectName"]) {
    if (pkg[prop] === undefined || typeof pkg[prop] !== "string") {
      return false;
    }
  }
  return true;
}

function isFrozenPackage(pkg: any): pkg is FrozenPackage {
  if (!isPackage(pkg)) {
    return false;
  }
  return (
    pkg.md5Hash !== undefined &&
    pkg.files !== undefined &&
    Object.isFrozen(pkg) &&
    pkg.files
      .map((f) => isFrozenPackageFile(f))
      .reduce(
        (prevPkgFileIsFrozen, curPkgFileIsFrozen) =>
          prevPkgFileIsFrozen && curPkgFileIsFrozen,
        true // defaults to true in case the file list is empty
      )
  );
}

// FIXME: this should maybe not be exported
export function fileListFromDirectory(
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
    .filter((dentry) => dentry.name !== undefined)
    .map((dentry) => {
      return {
        name: dentry.name!,
        projectName: pkg.projectName,
        packageName: pkg.name,
        size: dentry.size,
        modifiedTime: dentry.modifiedTime,
        md5Hash: dentry.md5
      };
    });

  return zip(fileDir.directoryEntries, files).map(([dentry, pkgFile]) =>
    packageFileFromDirectoryEntry(pkgFile, dentry)
  );
}

export async function fetchFileList(
  con: Connection,
  pkg: Package,
  options?: FetchFileListBaseOptions & { retrieveFileContents: true }
): Promise<[FrozenPackageFile[], string]>;

export async function fetchFileList(
  con: Connection,
  pkg: Package,
  options?: FetchFileListBaseOptions & {
    retrieveFileContents: false | undefined;
  }
): Promise<[PackageFile[], string]>;

export async function fetchFileList(
  con: Connection,
  pkg: Package,
  options?: FetchFileListBaseOptions & { retrieveFileContents?: boolean }
): Promise<[(PackageFile | FrozenPackageFile)[], string]> {
  const expand = options?.expandLinks === undefined || options.expandLinks;
  let route = `/source/${pkg.projectName}/${pkg.name}?expand=${
    expand ? "1" : "0"
  }`;
  if (
    options?.linkedRevisionIsBase !== undefined &&
    options.linkedRevisionIsBase
  ) {
    route = route.concat(`&linkrev=base`);
  }
  if (options?.revision !== undefined) {
    route = route.concat(`&rev=${options.revision}`);
  }
  const fileDir = await fetchDirectory(con, route);

  if (fileDir.sourceMd5 === undefined) {
    throw new Error(
      `File content listing of the package ${pkg.projectName}/${pkg.name} has no md5 hash defined`
    );
  }

  const files = fileListFromDirectory(pkg, fileDir);

  const retrieveFileContents =
    options?.retrieveFileContents !== undefined && options.retrieveFileContents;

  if (retrieveFileContents) {
    await Promise.all(
      files.map(async (f) => {
        f.contents = await fetchFileContents(con, f, {
          expandLinks: options?.expandLinks,
          // we need to pass the md5Hash of the package into here and **not**
          // the one that the user provided, because they will **not** match if
          // we used linkedRevisionIsBase = true!
          revision: fileDir.sourceMd5
        });
      })
    );
  }

  return [
    retrieveFileContents ? files.map((f) => Object.freeze(f)) : files,
    fileDir.sourceMd5
  ];
}

/** handy for tests, don't make it public though... */
export function fileListToDirectory(pkg: Package): Directory {
  return {
    name: pkg.name,
    sourceMd5: pkg.md5Hash,
    directoryEntries:
      pkg.files === undefined
        ? []
        : pkg.files.map((pkgFile) => {
            return {
              name: pkgFile.name,
              size: pkgFile.size,
              md5: pkgFile.md5Hash,
              mtime:
                pkgFile.modifiedTime !== undefined
                  ? unixTimeStampFromDate(pkgFile.modifiedTime).toString()
                  : undefined
            };
          })
  };
}

export async function createPackage(
  con: Connection,
  project: Project | string,
  packageName: string,
  title: string,
  description?: string
): Promise<Package> {
  const meta: PackageMeta = {
    title,
    description: description ?? title,
    name: packageName
  };
  const projectName = typeof project === "string" ? project : project.name;
  await setPackageMeta(con, projectName, packageName, meta);
  return { name: packageName, apiUrl: con.url, meta, projectName };
}

export async function fetchPackage(
  con: Connection,
  project: Project | string,
  packageName: string,
  options: Omit<FetchFileListBaseOptions, "revision"> & {
    retrieveFileContents: true;
  }
): Promise<FrozenPackage>;

export async function fetchPackage(
  con: Connection,
  project: Project | string,
  packageName: string,
  options?: Omit<FetchFileListBaseOptions, "revision"> & {
    retrieveFileContents?: boolean;
  }
): Promise<PackageWithMeta>;

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
  options?: Omit<FetchFileListBaseOptions, "revision"> & {
    retrieveFileContents?: boolean;
  }
): Promise<PackageWithMeta | FrozenPackage> {
  const projName: string = typeof project === "string" ? project : project.name;

  const basePkg = {
    apiUrl: con.url,
    name: packageName,
    projectName: projName
  };
  const [filesAndHash, meta] = await Promise.all([
    fetchFileList(
      con,
      basePkg,
      // HACK: the cast here is required as typescript is for some reason not
      // able to figure out that undefined|false and true are equal to
      // undefined|boolean...
      options as FetchFileListBaseOptions & {
        retrieveFileContents: false | undefined;
      }
    ),
    getPackageMeta(con, projName, packageName)
  ]);

  const pkg = {
    ...basePkg,
    files: filesAndHash[0],
    md5Hash: filesAndHash[1],
    meta
  };

  if (options?.retrieveFileContents) {
    Object.freeze(pkg);
    assert(
      isFrozenPackage(pkg),
      `Package ${packageName} should have resulted in a FrozenPackage, but got an ordinary one instead`
    );
  }

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

/** Deletes the [[Package]] `pkg`. */
export async function deletePackage(
  con: Connection,
  pkg: Package
): Promise<StatusReply>;

export async function deletePackage(
  con: Connection,
  projNameOrPkg: string | Package,
  packageName?: string
): Promise<StatusReply> {
  assert(
    typeof projNameOrPkg === "string"
      ? packageName !== undefined
      : packageName === undefined,
    `Invalid overload usage: when projNameOrPkg (${projNameOrPkg}) is a string, then packageName (${packageName}) must be a string as well. Otherwise it must be undefined.`
  );
  const route =
    typeof projNameOrPkg === "string"
      ? `/source/${projNameOrPkg}/${packageName}`
      : `/source/${projNameOrPkg.projectName}/${projNameOrPkg.name}`;
  const response = await con.makeApiCall(route, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(response);
}

async function writePackageFiles(
  pkg: PackageWithRequiredFiles,
  path: string
): Promise<void> {
  await Promise.all(
    pkg.files.map((f) => fsPromises.writeFile(join(path, f.name), f.contents))
  );
}

const mandatoryPkgUnderscoreFiles = [
  "_osclib_version",
  "_apiurl",
  "_package",
  "_project",
  "_files"
];

const optionalPkgUnderscoreFiles = ["_meta"];

export async function writePackageUnderscoreFiles(
  pkg: PackageWithRequiredFiles,
  path: string
): Promise<void> {
  const basePath = join(path, ".osc");

  const dir = fileListToDirectory(pkg);

  await Promise.all(
    [
      { fname: "_osclib_version", contents: "1.0" },
      { fname: "_apiurl", contents: pkg.apiUrl },
      {
        fname: "_meta",
        contents:
          pkg.meta !== undefined
            ? newXmlBuilder().buildObject(packageMetaToApi(pkg.meta))
            : undefined
      },
      {
        fname: "_package",
        contents: pkg.name
      },
      {
        fname: "_project",
        contents: pkg.projectName
      },
      {
        fname: "_files",
        contents: newXmlBuilder().buildObject(directoryToApi(dir))
      }
    ]
      .map(({ fname, contents }) => {
        return contents === undefined
          ? Promise.resolve()
          : fsPromises.writeFile(join(basePath, fname), contents);
      })
      .concat(writePackageFiles(pkg, basePath))
  );
}

/**
 * This function saves a package to the file system in a similar fashion as
 * `osc` would:
 * - the files are saved in the directory `${path}`
 * - metadata are saved in `${path}/.osc`:
 *   `_apiurl`: url to the api
 *   `_package`: the name of the package
 *   `_osclib_version`: contains the string 1.0
 *   `_project`: the name of the project
 *   `_files`: contains the file list at the checked out revision as received
 *             from OBS' API (a so-called directory listing)
 * - the packages files at the checked out revision are saved in `${path}/.osc`
 */
export async function checkOutPackageToFs(
  pkg: FrozenPackage,
  path: string
): Promise<ModifiedPackage> {
  await createOrEnsureEmptyDir(path);
  await fsPromises.mkdir(join(path, ".osc"), { recursive: false });

  await Promise.all([
    writePackageUnderscoreFiles(pkg, path),
    writePackageFiles(pkg, path)
  ]);

  const { files, ...restOfPkg } = pkg;
  return {
    ...restOfPkg,
    files: files.map((f) => Object.freeze(f)),
    filesInWorkdir: files.map((f) => ({ state: FileState.Unmodified, ...f })),
    path
  };
}

/**
 * Fetches the package `packageName` from the project `projectName` and checks
 * it out to the file system.
 *
 * @param path  Directory into which the package shall be checked out. If the
 *     directory does not exist, then it is created. If it exists, then it must
 *     be empty.
 */
export async function checkOutPackage(
  con: Connection,
  projectName: string,
  packageName: string,
  path: string
): Promise<ModifiedPackage>;

/**
 * Checks a package out to the file system.
 *
 * @param pkg  The package that should be written to the file system.
 * @param path  Directory into which the package shall be checked out. If the
 *     directory does not exist, then it is created. If it exists, then it must
 *     be empty.
 */
export async function checkOutPackage(
  pkg: FrozenPackage,
  path: string
): Promise<ModifiedPackage>;

export async function checkOutPackage(
  conOrFrozenPkg: Connection | FrozenPackage,
  projectNameOrPath: string,
  packageName?: string,
  path?: string
): Promise<ModifiedPackage> {
  if (isFrozenPackage(conOrFrozenPkg)) {
    return checkOutPackageToFs(conOrFrozenPkg, projectNameOrPath);
  }

  assert(
    packageName !== undefined && path !== undefined,
    `Invalid overload usage: packageName and path must both be defined when conOrFrozenPkg (${conOrFrozenPkg}) is a Connection.`
  );

  const frzPkg = await fetchPackage(
    conOrFrozenPkg,
    projectNameOrPath,
    packageName,
    { retrieveFileContents: true }
  );
  return checkOutPackageToFs(frzPkg, path);
}

/**
 * Construct a [[Package]] from a previously checked out package.
 *
 * @param path  Path to the directory where the package has been checked out to.
 *
 * @return A [[Package]] object with the files
 */
export async function readInCheckedOutPackage(
  path: string
): Promise<FrozenPackage> {
  const [
    osclibVersion,
    apiUrlRaw,
    nameRaw,
    projectNameRaw,
    fileDirectoryXml
  ] = await Promise.all(
    mandatoryPkgUnderscoreFiles.map(async (fname) =>
      (await fsPromises.readFile(join(path, ".osc", fname))).toString()
    )
  );

  const apiUrl = apiUrlRaw.trim();
  const name = nameRaw.trim();
  const projectName = projectNameRaw.trim();

  const [metaXml] = await Promise.all(
    optionalPkgUnderscoreFiles.map(async (fname) => {
      try {
        return (
          await fsPromises.readFile(join(path, ".osc", fname))
        ).toString();
      } catch {
        return undefined;
      }
    })
  );

  const meta =
    metaXml !== undefined
      ? packageMetaFromApi(await newXmlParser().parseStringPromise(metaXml))
      : undefined;

  if (parseFloat(osclibVersion) !== 1.0) {
    throw Error(
      `Package ${name} in ${path} has an invalid osclib version: ${osclibVersion} (expected 1.0)`
    );
  }

  const dir = directoryFromApi(
    await newXmlParser().parseStringPromise(fileDirectoryXml)
  );

  // FIXME: actually we should be able to calculate the md5Hash of the package
  // if we have all contents
  if (dir.sourceMd5 === undefined) {
    throw new Error(
      `Got an invalid package: '${path}/.osc/_files' does not have the srcmd5 attribute.`
    );
  }

  const pkg = { apiUrl, name, projectName, meta, md5Hash: dir.sourceMd5 };

  const emptyFiles = fileListFromDirectory(pkg, dir);

  const files = await Promise.all(
    emptyFiles.map(async (f) => {
      f.contents = await fsPromises.readFile(join(path, ".osc", f.name));

      // ensure that the hash is present
      const curHash = calculateHash(f.contents, "md5");
      if (f.md5Hash === undefined) {
        f.md5Hash = curHash;
      } else {
        // !the hash is wrong!
        if (curHash !== f.md5Hash) {
          throw new Error(
            `reading in package ${pkg.name} from ${path}: file hash of ${f.name} (${curHash}) does not match the expected hash '${f.md5Hash}'`
          );
        }
      }
      return f as FrozenPackageFile;
    })
  );

  return { files, ...pkg };
}

/** Options for customizing the branching of a [[Package]]. */
export interface BranchOptions {
  /**
   * Specify the project into which the package will be branched.
   * Defaults to `home:$USERNAME:branches:$PROJECTNAME`.
   */
  targetProject?: string;

  /**
   * Specify the name of the package as which the package will be branched.
   * Defaults to the original packages' name.
   */
  targetPackage?: string;
}

/** internal function to branch a package */
async function _branchPackage(
  con: Connection,
  pkg: Package,
  branchOptions?: BranchOptions
): Promise<PackageWithMeta> {
  if (normalizeUrl(con.url) !== normalizeUrl(pkg.apiUrl)) {
    throw new Error(
      `The package ${pkg.projectName}/${pkg.name} belongs to the API ${pkg.apiUrl} but the connection is only valid for ${con.url}`
    );
  }

  let route = `/source/${pkg.projectName}/${pkg.name}?cmd=branch`;

  const targetProject =
    branchOptions?.targetProject ??
    `home:${con.username}:branches:${pkg.projectName}`;
  const targetPackage = branchOptions?.targetPackage ?? pkg.name;

  if (
    branchOptions?.targetPackage !== undefined ||
    branchOptions?.targetProject !== undefined
  ) {
    const params = ["&"];
    if (branchOptions.targetPackage !== undefined) {
      params.push(`target_package=${branchOptions.targetPackage}`);
    }
    if (branchOptions.targetProject !== undefined) {
      params.push(
        `${params.length > 1 ? "&" : ""}target_project=${
          branchOptions.targetProject
        }`
      );
    }
    assert(params.length === 2 || params.length === 3);
    route = route.concat(...params);
  }

  const status = statusReplyFromApi(
    await con.makeApiCall(route, {
      method: RequestMethod.POST
    })
  );

  if (status.data !== undefined) {
    if (
      status.data["targetproject"] !== undefined &&
      status.data["targetproject"] !== targetProject
    ) {
      throw new Error(
        `branch resulted in an invalid target project, got ${status.data["targetproject"]} but expected ${targetProject}`
      );
    }
    if (
      status.data["targetpackage"] !== undefined &&
      status.data["targetpackage"] !== targetPackage
    ) {
      throw new Error(
        `branch resulted in an invalid target package, got ${status.data["targetpackage"]} but expected ${targetPackage}`
      );
    }
    if (
      status.data["sourcepackage"] !== undefined &&
      status.data["sourcepackage"] !== pkg.name
    ) {
      throw new Error(
        `branch was run with an invalid source package, got ${status.data["sourcepackage"]} but expected ${pkg.name}`
      );
    }
    if (
      status.data["sourceproject"] !== undefined &&
      status.data["sourceproject"] !== pkg.projectName
    ) {
      throw new Error(
        `branch was run with an invalid source project, got ${status.data["sourceproject"]} but expected ${pkg.projectName}`
      );
    }
  }

  return fetchPackage(con, targetProject, targetPackage, {
    expandLinks: true,
    retrieveFileContents: false
  });
}

/**
 * Branch the package `${projectName}/${packageName}` using the [[Connection]]
 * `con` and the supplied options `branchOptions`.
 *
 * A branch operation in the Open Build Service creates something like a copy of
 * the package: a new package is created in your home project (by default), but
 * it is "linked" to the original. This is achieved via a `_link` file (that
 * you'll never see in most cases) which keeps your branched package up to date.
 */
export async function branchPackage(
  con: Connection,
  projectName: string,
  packageName: string,
  branchOptions?: BranchOptions
): Promise<PackageWithMeta>;

/**
 * Branch the package `pkg` using the [[Connection]] `con` and the supplied
 * options `branchOptions`.
 */
export async function branchPackage(
  con: Connection,
  pkg: Package,
  branchOptions?: BranchOptions
): Promise<PackageWithMeta>;

export function branchPackage(
  con: Connection,
  pkgOrProjectName: Package | string,
  packageNameOrOptions?: string | BranchOptions,
  branchOptions?: BranchOptions
): Promise<PackageWithMeta> {
  if (typeof pkgOrProjectName === "string") {
    assert(
      packageNameOrOptions !== undefined &&
        typeof packageNameOrOptions === "string"
    );
    return _branchPackage(
      con,
      {
        apiUrl: con.url,
        projectName: pkgOrProjectName,
        name: packageNameOrOptions
      },
      branchOptions
    );
  } else {
    assert(typeof packageNameOrOptions !== "string");
    return _branchPackage(con, pkgOrProjectName, packageNameOrOptions);
  }
}
