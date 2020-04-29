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
  packageMetaToApi
} from "./api/package-meta";
import { calculateHash } from "./checksum";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import {
  fetchFileContents,
  PackageFile,
  packageFileFromDirectoryEntry
} from "./file";
import { Project } from "./project";
import { unixTimeStampFromDate, zip } from "./util";
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
  const expand = expandLinks === undefined || expandLinks;
  const directoryBaseRoute = `/source/${pkg.projectName}/${pkg.name}?expand=${
    expand ? "1&linkrev=base" : 0
  }`;
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

  const files = fileListFromDirectory(pkg, fileDir);

  if (retrieveFileContents !== undefined && retrieveFileContents) {
    await Promise.all(
      files.map(async (f) => {
        f.contents = await fetchFileContents(con, f, { expandLinks, revision });
      })
    );
  }
  return [files, fileDir.sourceMd5];
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
        packageName: pkg.name
      };
    });

  return zip(fileDir.directoryEntries, files).map(([dentry, pkgFile]) =>
    packageFileFromDirectoryEntry(pkgFile, dentry)
  );
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
    apiUrl: con.url,
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

async function writePackageFiles(pkg: Package, path: string): Promise<void> {
  if (pkg.files === undefined) {
    return;
  }
  await Promise.all(
    pkg.files.map((f) =>
      fsPromises.writeFile(join(path, f.name), f.contents ?? "")
    )
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
  pkg: Package,
  path: string
): Promise<void> {
  if (pkg.files === undefined) {
    throw new Error(
      `Cannot save package ${pkg.name}: the file list has not been retrieved yet.`
    );
  }

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
 * Checks a package out to the file system.
 *
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
 *
 * @param pkg  The package that should be written to the file system.
 *     The package's files **must** have been retrieved beforehand, otherwise an
 *     exception is thrown.
 * @param path  Directory into which the package shall be checked out. The
 *     directory **must not** exist already.
 */
export async function checkOutPackage(
  pkg: Package,
  path: string
): Promise<ModifiedPackage> {
  if (pkg.files === undefined) {
    throw new Error(
      `Cannot checkout package ${pkg.name}: file list has not been retrieved yet`
    );
  }
  await fsPromises.mkdir(path, { recursive: false });
  await fsPromises.mkdir(join(path, ".osc"), { recursive: false });

  await Promise.all([
    writePackageUnderscoreFiles(pkg, path),
    writePackageFiles(pkg, path)
  ]);

  const { files, ...restOfPkg } = pkg;
  return {
    ...restOfPkg,
    files: files.map((f) => ({ state: FileState.Unmodified, ...f })),
    path
  };
}

/**
 * Construct a [[Package]] from a previously checked out package.
 *
 * @param path  Path to the directory where the package has been checked out to.
 *
 * @return A [[Package]] object with the files
 */
export async function readInCheckedOutPackage(path: string): Promise<Package> {
  let [
    osclibVersion,
    apiUrl,
    name,
    projectName,
    fileDirectoryXml
  ] = await Promise.all(
    mandatoryPkgUnderscoreFiles.map(async (fname) =>
      (await fsPromises.readFile(join(path, ".osc", fname))).toString()
    )
  );

  apiUrl = apiUrl.trim();
  name = name.trim();
  projectName = projectName.trim();

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

  const pkg = { apiUrl, name, projectName, meta, md5Hash: dir.sourceMd5 };

  const files = fileListFromDirectory(pkg, dir);

  await Promise.all(
    files.map(async (f) => {
      f.contents = await fsPromises.readFile(join(path, ".osc", f.name));

      // ensure that the hash is present
      const curHash = calculateHash(f.contents, "md5");
      if (f.md5Hash === undefined) {
        f.md5Hash = curHash;
      } else {
        // !the hash is wrong!
        if (curHash !== f.md5Hash) {
          throw new Error(
            `Error reading in package ${pkg.name} from ${path}: file hash of ${f.name} (${curHash}) does not match the expected hash ${f.md5Hash}`
          );
        }
      }
    })
  );

  return { files, ...pkg };
}
