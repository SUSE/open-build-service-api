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
import { URL } from "url";
import { Arch } from "./api/base-types";
import { Connection } from "./connection";
import { BasePackage } from "./package";
import { BaseProject } from "./project";
import {
  dateFromUnixTimeStamp,
  mapOrApply,
  mapOrApplyOptional,
  strToInt,
  undefinedIfNoInput,
  withoutUndefinedMembers
} from "./util";

/** Possible views/types of data that can be requested from OBS */
export const enum BuildStatusView {
  /** Results in [[BuildResult.summary]] being populated */
  Summary = "summary",
  /** Default view, results in [[BuildResult.packageStatus]] to be populated. */
  Status = "status",
  /** Results in [[BuildResult.binaries]] being populated */
  BinaryList = "binarylist"
}

interface StatusApiReply {
  $: { package: string; code: PackageStatusCode };
  details?: string[] | string;
}

/** Possible states of a repository */
export const enum RepositoryCode {
  Unknown = "unknown",
  /** The repository's configuration is broken, no builds are possible */
  Broken = "broken",
  /** The packages in the repository are being scheduled */
  Scheduling = "scheduling",
  /**
   * The repository cannot start building as it waits for external packages to
   * finish building first
   */
  Blocked = "blocked",
  /** Packages are being build */
  Building = "building",
  /** Packages have finished building */
  Finished = "finished",
  /**
   * Packages have finished building and the publisher has started publishing
   * this repository
   */
  Publishing = "publishing",
  /** The repository has been published */
  Published = "published",
  /** The repository has not been published */
  Unpublished = "unpublished"
}

/** Possible states of a package */
export const enum PackageStatusCode {
  /** The packages' dependencies cannot be resolved */
  Unresolvable = "unresolvable",
  /** The package has been build successfully */
  Succeeded = "succeeded",
  /** The package failed to build */
  Failed = "failed",
  /**
   * The package cannot be build, e.g. because a _link failed to expand, no
   * sources are present, etc.
   */
  Broken = "broken",
  /** The package has been disabled from building */
  Disabled = "disabled",
  /**
   * The package is excluded from building on this architecture/in this
   * repository
   */
  Excluded = "excluded",
  /**
   * One of the packages dependencies is not yet available (e.g. still building)
   */
  Blocked = "blocked",
  /** The package is locked from rebuilds */
  Locked = "locked",
  Unknown = "unknown",
  /** The package is scheduled and waiting for a worker */
  Scheduled = "scheduled",
  /** The package is building */
  Building = "building",
  /** The package has just finished building */
  Finished = "finished"
}

interface ResultListApiReply {
  resultlist: {
    $: { state: string };
    result: ResultApiReply;
  };
}

interface StatusCountApiReply {
  $: {
    code: PackageStatusCode;
    count: string;
  };
}

interface BinaryApiReply {
  $: { filename: string; size: string; mtime: string };
}

/**
 * A binary that is produced by a build and is available for download.
 */
export interface Binary {
  /** The name of this file */
  readonly filename: string;
  /** The file's size in bytes */
  readonly size: number;
  /** The time at which the binary was produced */
  readonly modifiedTime: Date;
}

interface BinaryListApiReply {
  $: { package: string };
  binary?: BinaryApiReply[] | BinaryApiReply;
}

interface ResultApiReply {
  $: {
    project: string;
    repository: string;
    arch: Arch;
    // code and state are the same thing, state is going to be deprecated eventually
    code: RepositoryCode;
    state: RepositoryCode;
    dirty?: "true" | "false";
  };
  status?: StatusApiReply[] | StatusApiReply;
  summary?: { statuscount: StatusCountApiReply[] | StatusCountApiReply };
  binarylist?: BinaryListApiReply | BinaryListApiReply[];
}

function buildResultFromApi(buildRes: ResultApiReply): BuildResult {
  const { project, repository, arch, code, dirty } = buildRes.$;
  const { status, summary, binarylist } = buildRes;

  return withoutUndefinedMembers({
    project,
    repository,
    arch,
    code,
    dirty: dirty === undefined ? false : dirty === "true",
    packageStatus:
      status === undefined
        ? undefined
        : new Map(
            mapOrApply(status, (st) => [
              st.$.package,
              withoutUndefinedMembers({
                code: st.$.code,
                details:
                  typeof st.details === "string"
                    ? st.details
                    : st.details?.join("\n")
              })
            ])
          ),
    binaries:
      binarylist === undefined
        ? undefined
        : new Map(
            mapOrApply(binarylist, (binLst) => [
              binLst.$.package,
              mapOrApplyOptional(binLst.binary, (bin) => ({
                size: strToInt(bin.$.size),
                filename: bin.$.filename,
                modifiedTime: dateFromUnixTimeStamp(bin.$.mtime)
              }))
            ])
          ),
    summary:
      summary === undefined
        ? undefined
        : new Map(
            mapOrApply(summary.statuscount, (stCnt) => [
              stCnt.$.code,
              strToInt(stCnt.$.count)
            ])
          )
  });
}

/**
 * Summary of all build results of a single repository for a project and a
 * specific architecture.
 */
export interface BuildResult {
  /** Name of the project */
  readonly project: string;
  /** Name of the repository */
  readonly repository: string;
  /** Architecture of the build results */
  readonly arch: Arch;
  /** status of the Repository */
  readonly code: RepositoryCode;
  /** Is the repository currently rebuilding and has not "settled" yet? */
  readonly dirty: boolean;

  /**
   * If one of the requested views is [[BuildStatusView.Status]] (or omitted),
   * then this entry is defined and contains a map for each requested package
   * containing its current status (in the `code` field) and an optional
   * `detail` entry explaining its current state.
   */
  readonly packageStatus?: Map<
    string,
    { code: PackageStatusCode; details?: string }
  >;

  /**
   * If one of the requested views is [[BuildStatusView.BinaryList]], then this
   * entry is defined and contains a map mapping each package name to an array
   * of binaries that it produced.
   */
  readonly binaries?: Map<string, Binary[]>;

  /**
   * If one of the requested views is [[BuildStatusView.Summary]], then this
   * entry is defined and contains a map mapping every [[PackageStatusCode]]
   * present in the current filtered request to the number of packages matching
   * this code. Status codes with no occurrences are omitted from the map.
   */
  readonly summary?: Map<PackageStatusCode, number>;
}

/**
 * Retrieves the build results of a project.
 *
 * By default the status view ([[BuildStatusView.Status]]) is returned for all
 * repositories, all packages and all architectures of the project. This results
 * in a lot of data and can take a substantial amount of time to fetch, thus the
 * view can be narrowed down by filtering certain packages, repositories and/or
 * architectures.
 * The optional entries of the returned [[BuildResult]] are defined depending on
 * the parameter `views`. If it is omitted, then [[BuildStatusView.Status]] is
 * assumed and the [[BuildResutl.packageStatus]] is defined. If
 * [[BuildStatusView.Summary]] is in `views`, then [[BuildResutl.summary]] is
 * defined and if [[BuildStatusView.BinaryList]] is in `views`, then
 * [[BuildResutl.binaries]] is defined.
 *
 * @param con  The connection for performing the API call
 * @param project  The project which' build results are to be fetched.
 *
 * @param packages  An array of Packages or package names. If supplied, only the
 *     build results of these packages are returned. By default all packages are
 *     considered.
 *     Specifying an invalid package name results in an error.
 * @param architectures  An array of architecture names. If supplied, only build
 *     results for these architectures are returned. Otherwise, all
 *     architectures are included in the build result.
 *     Specifying an invalid architecture does not trigger an error.
 * @param repositories  An array of repository names that should only be included
 *     in the result. Invalid repository names result in an error. By default
 *     all repositories are queried.
 * @param views  An array of views. The views determine which type of data is
 *     fetched from the Build Service.
 *     Defaults to `[BuildStatusView.Status]`.
 * @param lastBuild  Instead of fetching the current build result, the last
 *     finished one is retrieved (to avoid getting build results that are
 *     currently building).
 *     Defaults to `false`.
 * @param localLink  Include build results from packages with project local links
 *     Defaults to `false`.
 * @param multiBuild  Include build results from multibuild packages (these are )
 */
export async function fetchBuildResults(
  con: Connection,
  project: BaseProject | string,
  {
    packages,
    architectures,
    repositories,
    views,
    lastBuild,
    localLink,
    multiBuild
  }: {
    packages?: (BasePackage | Omit<BasePackage, "apiUrl"> | string)[];
    architectures?: Arch[];
    repositories?: string[];
    views?: BuildStatusView[];
    lastBuild?: boolean;
    localLink?: boolean;
    multiBuild?: boolean;
  } = {}
): Promise<BuildResult[]> {
  const url = new URL(
    `${con.url.href}build/${
      typeof project === "string" ? project : project.name
    }/_result`
  );

  packages?.forEach((pkg) => {
    const pkgName = typeof pkg === "string" ? pkg : pkg.name;
    url.searchParams.append("package", pkgName);
  });
  architectures?.forEach((arch) => url.searchParams.append("arch", arch));
  repositories?.forEach((repo) => url.searchParams.append("repository", repo));
  views?.forEach((view) => url.searchParams.append("view", view.toString()));
  const buildOpts: [string, boolean?][] = [
    ["lastbuild", lastBuild],
    ["locallink", localLink],
    ["multibuild", multiBuild]
  ];
  buildOpts.forEach(([optName, value]) => {
    if (value !== undefined) {
      url.searchParams.append(optName, value ? "1" : "0");
    }
  });

  const resList: ResultListApiReply = await con.makeApiCall(url);

  return mapOrApply(resList.resultlist.result, buildResultFromApi);
}

function createBuildRoute(
  projectNameOrPkg: string | BasePackage | Omit<BasePackage, "apiUrl">,
  packageNameOrArch: string | Arch,
  archOrRepositoryName: Arch | string,
  repositoryNameOrMultibuild?: string,
  multibuildName?: string
): string {
  if (typeof projectNameOrPkg === "string") {
    // this overload is used:
    // (
    //   con: Connection,
    //   projectName: string,
    //   packageName: string,
    //   arch: Arch,
    //   repositoryName: string,
    //   multibuildName?: string
    // )
    assert(
      typeof packageNameOrArch === "string" &&
        repositoryNameOrMultibuild !== undefined
    );
    const pkgName =
      multibuildName === undefined
        ? packageNameOrArch
        : `${packageNameOrArch}:${multibuildName}`;
    return `/${projectNameOrPkg}/${repositoryNameOrMultibuild}/${archOrRepositoryName}/${pkgName}`;
  } else {
    // this overload is used:
    // (
    //   con: Connection,
    //   pkg: BasePackage | Omit<BasePackage, "apiUrl">,
    //   arch: Arch,
    //   repositoryName: string,
    //   multibuildName?: string
    // )
    assert(multibuildName === undefined);

    const pkgName =
      repositoryNameOrMultibuild === undefined
        ? projectNameOrPkg.name
        : `${projectNameOrPkg.name}:${repositoryNameOrMultibuild}`;

    return `/${projectNameOrPkg.projectName}/${archOrRepositoryName}/${packageNameOrArch}/${pkgName}`;
  }
}

interface BuildStatusApiReply {
  status: {
    $: { package: string; code: PackageStatusCode; dirty?: "true" | "false" };
    details?: "" | string | string[];
  };
}

/** Status of a package build */
export interface BuildStatus {
  /** Name of the package */
  readonly packageName: string;
  /** status of the build */
  readonly code: PackageStatusCode;
  /**
   * Indicates whether the repository of this build job is in a dirty state
   * (i.e. other build jobs are present).
   */
  readonly dirty: boolean;
  /** Optional details about the build status */
  readonly details?: string;
}

function buildStatusFromApi(buildStatus: BuildStatusApiReply): BuildStatus {
  const { package: packageName, code, dirty } = buildStatus.status.$;
  const details = buildStatus.status.details;
  return withoutUndefinedMembers({
    packageName,
    code,
    dirty: dirty === undefined ? false : dirty === "true",
    details:
      details === undefined || details === ""
        ? undefined
        : Array.isArray(details)
        ? details.join("\n")
        : details
  });
}

export async function fetchBuildStatus(
  con: Connection,
  projectName: string,
  packageName: string,
  arch: Arch,
  repositoryName: string,
  multibuildName?: string
): Promise<BuildStatus>;
export async function fetchBuildStatus(
  con: Connection,
  pkg: BasePackage | Omit<BasePackage, "apiUrl">,
  arch: Arch,
  repositoryName: string,
  multibuildName?: string
): Promise<BuildStatus>;

/**
 * Fetch the status of the last or current build job.
 *
 * @throws [[ApiError]] if the package is invalid, if the repository does not
 *     exist or if there is no such architecture for the supplied repository.
 *
 * **Caution:** An invalid `multibuildName` does **not** result in an Error!
 * See: https://github.com/openSUSE/open-build-service/issues/10526
 */
export async function fetchBuildStatus(
  con: Connection,
  projectNameOrPkg: string | BasePackage | Omit<BasePackage, "apiUrl">,
  packageNameOrArch: string | Arch,
  archOrRepositoryName: Arch | string,
  repositoryNameOrMultibuild?: string,
  multibuildName?: string
): Promise<BuildStatus> {
  const route = `/build/${createBuildRoute(
    projectNameOrPkg,
    packageNameOrArch,
    archOrRepositoryName,
    repositoryNameOrMultibuild,
    multibuildName
  )}/_status`;

  return buildStatusFromApi(await con.makeApiCall(route));
}

interface JobStatusApiReply {
  jobstatus:
    | {
        $: { code: RepositoryCode; result?: JobResult; details?: string };
        starttime: string;
        endtime?: string;
        lastduration?: string;
        workerid: string;
        hostarch: Arch;
        arch?: Arch;
        uri: string;
        jobid: string;
        job: string;
        attempt?: string;
      }
    | "";
}

export const enum JobResult {
  Succeeded = "succeeded",
  Failed = "failed",
  Unchanged = "unchanged"
}

/** The status of a build job */
export interface JobStatus {
  /** Status of this build job */
  readonly code: RepositoryCode;

  /** If the job finished, then its result is available in this field */
  readonly result?: JobResult;

  readonly details?: string;

  /** Time at which the build job started */
  readonly startTime: Date;
  /**
   * Time at which the build job ended, if it finished, otherwise it is not
   * present.
   */
  readonly endTime?: Date;
  /** Duration of the previous build job. */
  readonly lastDuration?: number;
  /** Internal id of the worker */
  readonly workerId: string;

  /** Architecture of the worker */
  readonly hostArch: Arch;

  /** Architecture of the build */
  readonly arch?: Arch;

  /** Internal uri to reach the worker */
  readonly uri: string;

  /** md5 hash of the job id */
  readonly jobId: string;
  /** internal name of the job */
  readonly job?: string;
  /** number of attempts that were done to finish this job */
  readonly attempt?: number;
}

function jobStatusFromApi(jobStatus: JobStatusApiReply): JobStatus | undefined {
  if (jobStatus.jobstatus === "") {
    return undefined;
  }

  const {
    starttime,
    endtime,
    lastduration,
    workerid,
    hostarch,
    arch,
    uri,
    jobid,
    job,
    attempt
  } = jobStatus.jobstatus;
  return withoutUndefinedMembers({
    code: jobStatus.jobstatus.$.code,
    result: jobStatus.jobstatus.$.result,
    details: jobStatus.jobstatus.$.details,
    startTime: dateFromUnixTimeStamp(starttime),
    endTime: undefinedIfNoInput(endtime, dateFromUnixTimeStamp),
    lastDuration: undefinedIfNoInput(lastduration, strToInt),
    workerId: workerid,
    hostArch: hostarch,
    arch,
    uri,
    job,
    jobId: jobid,
    attempt: undefinedIfNoInput(attempt, strToInt)
  });
}

export async function fetchJobStatus(
  con: Connection,
  projectName: string,
  packageName: string,
  arch: Arch,
  repositoryName: string,
  multibuildName?: string
): Promise<JobStatus | undefined>;

export async function fetchJobStatus(
  con: Connection,
  pkg: BasePackage | Omit<BasePackage, "apiUrl">,
  arch: Arch,
  repositoryName: string,
  multibuildName?: string
): Promise<JobStatus | undefined>;

/**
 * Fetch the status of a running build job (if one exists).
 *
 * @return A promise resolving to a either a [[JobStatus]] or undefined if no
 *     build job exists.
 */
export async function fetchJobStatus(
  con: Connection,
  projectNameOrPkg: string | BasePackage | Omit<BasePackage, "apiUrl">,
  packageNameOrArch: string | Arch,
  archOrRepositoryName: Arch | string,
  repositoryNameOrMultibuild?: string,
  multibuildName?: string
): Promise<JobStatus | undefined> {
  const route = `/build/${createBuildRoute(
    projectNameOrPkg,
    packageNameOrArch,
    archOrRepositoryName,
    repositoryNameOrMultibuild,
    multibuildName
  )}/_jobstatus`;

  return jobStatusFromApi(await con.makeApiCall(route));
}

export const enum FetchFinishedLog {
  Last,
  LastSucceeded
}

/** Additional options for fetching build logs */
export interface LogFetchOptions {
  /**
   * For multibuild packages, the multibuild suffix/name can be specified here
   * to retrieve the appropriate logfile
   */
  multibuildName?: string;

  /**
   * When set to true, then the build service will send out the current log and
   * terminate the connection immediately even if the build has not finished
   * yet.
   * Set this option to retrieve the current log in a reasonable amount of time,
   * as [[fetchBuildLog]] will not resolve until the build has finished.
   *
   * Defaults to `false`.
   */
  noStream?: boolean;

  /**
   * Set this flag to retrieve either the log of the last build or the log of
   * the last successful build. If unset, then the current log is retrieved.
   */
  fetchFinishedLog?: FetchFinishedLog;

  /**
   * A callback function that is invoked every time a new chunk of the log is
   * received from the Build Service. If [[noStream]] is set to false, then
   * providing a callback results in an error.
   */
  streamCallback?: (logChunk: Buffer) => void;
  /** Optional `this` argument for [[streamCallback]] */
  streamCallbackThisArg?: any;

  /**
   * Timeout for the whole request when [[noStream]] is `false`. Defaults to 1
   * hour. This value is ignored when [[noStream]] is `true`.
   */
  streamTimeoutMs?: number;
}

export async function fetchBuildLog(
  con: Connection,
  projectName: string,
  packageName: string,
  arch: Arch,
  repositoryName: string,
  logFetchOptions?: LogFetchOptions
): Promise<string>;
export async function fetchBuildLog(
  con: Connection,
  pkg: BasePackage | Omit<BasePackage, "apiUrl">,
  arch: Arch,
  repositoryName: string,
  logFetchOptions?: LogFetchOptions
): Promise<string>;

export async function fetchBuildLog(
  con: Connection,
  projectNameOrPkg: string | BasePackage | Omit<BasePackage, "apiUrl">,
  packageNameOrArch: string | Arch,
  archOrRepositoryName: Arch | string,
  repositoryNameOrLogFetchOptions?: string | LogFetchOptions,
  logFetchOptions?: LogFetchOptions
): Promise<string> {
  if (logFetchOptions?.noStream === true) {
    if (logFetchOptions.streamCallback !== undefined) {
      throw new Error(
        "Cannot provide a stream callback with noStream set to true"
      );
    }
  }

  const repositoryNameOrMultibuild =
    typeof repositoryNameOrLogFetchOptions === "string"
      ? repositoryNameOrLogFetchOptions
      : repositoryNameOrLogFetchOptions?.multibuildName;
  const logFetchOpts =
    typeof repositoryNameOrLogFetchOptions === "string"
      ? logFetchOptions
      : repositoryNameOrLogFetchOptions;
  const route = `/build/${createBuildRoute(
    projectNameOrPkg,
    packageNameOrArch,
    archOrRepositoryName,
    repositoryNameOrMultibuild,
    logFetchOptions?.multibuildName
  )}/_log`;

  const url = new URL(route, con.url);

  let maxRetries: number | undefined;
  let timeoutMs: number | undefined;
  if (logFetchOptions?.noStream === true) {
    maxRetries = 0;
    timeoutMs = logFetchOpts?.streamTimeoutMs ?? 3600 * 1000;
  }

  if (logFetchOpts?.noStream === true) {
    url.searchParams.append("nostream", "1");
  }
  if (logFetchOpts?.fetchFinishedLog !== undefined) {
    if (logFetchOpts.fetchFinishedLog === FetchFinishedLog.Last) {
      url.searchParams.append("last", "1");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      assert(logFetchOpts.fetchFinishedLog === FetchFinishedLog.LastSucceeded);
      url.searchParams.append("lastsucceeded", "1");
    }
  }

  return (
    await con.makeApiCall(url, {
      decodeResponseFromXml: false,
      timeoutMs,
      maxRetries,
      onDataReceived: logFetchOpts?.streamCallback,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      onDataReceivedThisArg: logFetchOpts?.streamCallbackThisArg
    })
  ).toString();
}
