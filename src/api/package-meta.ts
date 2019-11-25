/**
 * This file contains functions to read and modify a packages `_meta`
 * configuration.
 */

import * as assert from "assert";
import { Connection, RequestMethod } from "../connection";
import { StatusReply, statusReplyFromApi } from "../error";
import {
  deleteUndefinedAndEmptyMembers,
  deleteUndefinedMembers
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
  $: { project?: string; package?: string };
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
    $: { name?: string; project?: string };
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

function packageMetaFromApi(
  packageMetaApiReply: PackageMetaApiReply
): PackageMeta {
  const res: PackageMeta = {
    name: packageMetaApiReply.package.$.name,
    project: packageMetaApiReply.package.$.project,
    develPackage: develPackageFromApi(packageMetaApiReply.package.devel),
    ...commonMetaFromApi(packageMetaApiReply.package)
  };
  deleteUndefinedAndEmptyMembers(res);
  return res;
}

function packageMetaToApi(packageMeta: PackageMeta): PackageMetaApiReply {
  const res: PackageMetaApiReply = {
    package: {
      $: { name: packageMeta.name, project: packageMeta.project },
      ...commonMetaToApi(packageMeta),
      devel: develPackageToApi(packageMeta.develPackage)
    }
  };
  deleteUndefinedMembers(res.package.$);
  deleteUndefinedAndEmptyMembers(res.package);
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
export async function getPackageMeta(
  con: Connection,
  projectName: string,
  packageName: string
): Promise<PackageMeta> {
  const res = await con.makeApiCall(metaRoute(projectName, packageName));
  return packageMetaFromApi(res);
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
export async function setProjectMeta(
  con: Connection,
  projectName: string,
  packageName: string,
  packageMeta: PackageMeta
): Promise<StatusReply> {
  assert(
    packageMeta.project !== undefined && packageMeta.name !== undefined
      ? packageMeta.project === projectName && packageMeta.name === packageName
      : true,
    `Assertion failed: package name and project name from the packageMeta (${packageMeta.name} and ${packageMeta.project}) do not match the parameters packageName (${packageName}) and projectName (${projectName})`
  );

  const res = await con.makeApiCall(metaRoute(projectName, packageName), {
    payload: packageMetaToApi(packageMeta),
    method: RequestMethod.PUT
  });

  return statusReplyFromApi(res);
}
