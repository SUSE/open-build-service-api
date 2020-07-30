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

/**
 * This file contains functions to read and modify a packages `_meta`
 * configuration.
 */

import * as assert from "assert";
import { Connection, RequestMethod } from "../connection";
import { StatusReply, statusReplyFromApi, StatusReplyApiReply } from "../error";
import {
  deleteUndefinedAndEmptyMembers,
  withoutUndefinedMembers
} from "../util";
import {
  CommonMeta,
  CommonMetaApiReply,
  commonMetaFromApi,
  commonMetaToApi
} from "./base-types";

/** Location of the development package */
export interface DevelPackage {
  project?: string;
  package?: string;
}

interface DevelPackageApiReply {
  $?: { project?: string; package?: string };
}

function develPackageFromApi(
  develPkgApiReply: DevelPackageApiReply | undefined
): DevelPackage | undefined {
  return develPkgApiReply === undefined ? undefined : develPkgApiReply.$;
}

function develPackageToApi(
  develPkg: DevelPackage | undefined
): DevelPackageApiReply | undefined {
  return develPkg === undefined ? undefined : { $: develPkg };
}

interface PackageMetaApiReply {
  package: {
    $?: { name?: string; project?: string };
    devel?: DevelPackageApiReply;
  } & CommonMetaApiReply;
}

/**
 * A package's `_meta` configuration.
 */
export interface PackageMeta extends CommonMeta {
  /** This package's name */
  readonly name?: string;

  /**
   * The project to which the package belongs.
   *
   * This attribute is often set by OBS itself.
   */
  readonly project?: string;

  /** The package where this package is developed. */
  develPackage?: DevelPackage;
}

export function packageMetaFromApi(
  packageMetaApiReply: PackageMetaApiReply
): PackageMeta {
  const res: PackageMeta = {
    name: packageMetaApiReply.package.$?.name,
    project: packageMetaApiReply.package.$?.project,
    develPackage: develPackageFromApi(packageMetaApiReply.package.devel),
    ...commonMetaFromApi(packageMetaApiReply.package)
  };
  return deleteUndefinedAndEmptyMembers(res);
}

export function packageMetaToApi(
  packageMeta: PackageMeta
): PackageMetaApiReply {
  const res: PackageMetaApiReply = {
    package: deleteUndefinedAndEmptyMembers({
      $: withoutUndefinedMembers({
        name: packageMeta.name,
        project: packageMeta.project
      }),
      ...commonMetaToApi(packageMeta),
      devel: develPackageToApi(packageMeta.develPackage)
    })
  };
  return res;
}

function metaRoute(projectName: string, packageName: string): string {
  return `/source/${projectName}/${packageName}/_meta`;
}

/**
 * Retrieve a package's `_meta`.
 *
 * @param con  The [[Connection]] which will be used to perform the request.
 * @param projectName  Name of the project to which the package belongs.
 * @param packageName  Name of the package
 *
 * @throw [[ApiError]] if the API call fails.
 *
 * @return An object adhering to the [[PackageMeta]] interface.
 */
export async function fetchPackageMeta(
  con: Connection,
  projectName: string,
  packageName: string
): Promise<PackageMeta> {
  return packageMetaFromApi(
    await con.makeApiCall<PackageMetaApiReply>(
      metaRoute(projectName, packageName)
    )
  );
}

/**
 * Modify a package's `_meta`. If the package does not exist, create it.
 *
 * @param con  The [[Connection]] which will be used to perform the request.
 * @param projectName  Name of the project to which the package belongs.
 * @param packageName  Name of the package
 * @param packageMeta  New value for the package's `_meta`
 *
 * @throw [[ApiError]] if the API call fails.
 * @throw AssertionError if the parameters `packageName` and `projectName` do
 *     not match the values from `packageMeta`.
 *
 * @return The [[StatusReply]] that is received from OBS.
 */
export async function setPackageMeta(
  con: Connection,
  projectName: string,
  packageName: string,
  packageMeta: PackageMeta
): Promise<StatusReply> {
  assert(
    packageMeta.project !== undefined && packageMeta.name !== undefined
      ? packageMeta.project === projectName && packageMeta.name === packageName
      : true,
    `Assertion failed: package name and project name from the packageMeta (${
      packageMeta.name ?? "undefined"
    } and ${
      packageMeta.project ?? "undefined"
    }) do not match the parameters packageName (${packageName}) and projectName (${projectName})`
  );

  return statusReplyFromApi(
    await con.makeApiCall<StatusReplyApiReply>(
      metaRoute(projectName, packageName),
      {
        payload: packageMetaToApi(packageMeta),
        method: RequestMethod.PUT
      }
    )
  );
}
