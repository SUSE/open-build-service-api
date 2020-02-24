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
 * Collection of base types shared by the API module and the user facing modules
 */

import {
  Group,
  GroupApiReply,
  groupFromApi,
  groupToApi,
  User,
  UserApiReply,
  userFromApi,
  userToApi
} from "../user";
import {
  deleteUndefinedAndEmptyMembers,
  extractElementAsArrayIfPresent,
  extractElementIfPresent,
  extractElementOrDefault
} from "../util";
import {
  booleanToSimpleFlag,
  Flag,
  FlagApiReply,
  flagFromApi,
  flagToApi,
  SimpleFlagApiReply,
  simpleFlagToBoolean
} from "./flag";
import { Kind } from "./project-meta";

/** Possible modes/policies used by OBS when to rebuild packages */
export enum RebuildMode {
  /**
   * DEFAULT: build on source change and all depending packages including
   * indirect dependencies
   */
  Transitive = "transitive",
  /** build on source change and direct depending packages */
  Direct = "direct",
  /** build on source change only */
  Local = "local"
}

/**
 * Possible modes how packages will be blocked from rebuilding on dependency
 * changes
 */
export enum BlockMode {
  /** DEFAULT: block until all packages we depend on are built */
  All = "all",
  /** like all, but ignore packages from other repositories */
  Local = "local",
  /** immediately start building the packages */
  Never = "never"
}

/** Rebuild policy for linked projects */
export enum LinkedBuildMode {
  /** DEFAULT: do not build packages from project links */
  Off = "off",
  /** only build project linked packages if they depend on a local package */
  LocalDep = "localdep",
  /** treat packages from project links like local packages */
  All = "all"
}

/** TODO */
export interface ReleaseTarget {
  readonly project: string;
  readonly repository: string;
  readonly trigger: ReleaseTrigger;
}

/** ReleaseTarget as reported by OBS' API */
export interface ReleaseTargetApiReply {
  $: {
    project: string;
    repository: string;
    trigger?: ReleaseTrigger;
  };
}

/** Convert the reply from OBS' API into a [[ReleaseTarget]] interface */
export function releaseTargetFromApi(
  data: ReleaseTargetApiReply
): ReleaseTarget {
  return {
    project: data.$.project,
    repository: data.$.repository,
    trigger: extractElementOrDefault(
      data.$,
      "trigger",
      ReleaseTrigger.NoRelease
    )
  };
}

/** Convert a [[ReleaseTarget]] back to the form that OBS' API expects */
export function releaseTargetToApi(
  releaseTarget: ReleaseTarget
): ReleaseTargetApiReply {
  return {
    $: {
      project: releaseTarget.project,
      repository: releaseTarget.repository,
      trigger:
        releaseTarget.trigger === ReleaseTrigger.NoRelease
          ? undefined
          : releaseTarget.trigger
    }
  };
}

/**
 * Path to a repository of a project in the Open Build Service.
 *
 * E.g. to refer to `openSUSE:Factory/standard`:
 * ```
 * { project: "openSUSE:Factory", repository: "standard" }
 * ```
 */
export interface Path {
  /** Name of the project, which repository we want to reference */
  readonly project: string;
  /** Name of the repository in the given project */
  readonly repository: string;
}

/** A [[Path]] as obtained via OBS' API */
export interface PathApiReply {
  $: { repository: string; project: string };
}

/** Converts a API reply from OBS to a [[Path]] */
export function pathFromApi(data: PathApiReply): Path {
  return { ...data.$ };
}

/** Converts a [[Path]] back to the form which OBS' API expects */
export function pathToApi(path: Path): PathApiReply {
  return { $: { ...path } };
}

/** TODO */
export enum VrevMode {
  Standard = "standard",
  Unextend = "unextend",
  Extend = "extend"
}

/** Interface describing a link between two projects */
export interface Link {
  readonly vrevmode: VrevMode;
  readonly project: string;
}

export interface LinkApiReply {
  $: {
    vrevmode?: VrevMode;
    project: string;
  };
}

export function linkFromApi(data: LinkApiReply): Link {
  let vrevmode = extractElementIfPresent<VrevMode>(data.$, "vrevmode");
  if (vrevmode === undefined) {
    vrevmode = VrevMode.Standard;
  }

  return { project: data.$.project, vrevmode };
}

export function linkToApi(link: Link): LinkApiReply {
  return { $: link };
}

/** Architectures supported by OBS */
export enum Arch {
  Noarch = "noarch",
  Aarch64 = "aarch64",
  Aarch64Ilp32 = "aarch64_ilp32",
  Armv4l = "armv4l",
  Armv5l = "armv5l",
  Armv6l = "armv6l",
  Armv7l = "armv7l",
  Armv5el = "armv5el",
  Armv6el = "armv6el",
  Armv7el = "armv7el",
  Armv7hl = "armv7hl",
  Armv8el = "armv8el",
  Hppa = "hppa",
  M68k = "m68k",
  I386 = "i386",
  I486 = "i486",
  I586 = "i586",
  I686 = "i686",
  Athlon = "athlon",
  Ia64 = "ia64",
  K1om = "k1om",
  Mips = "mips",
  Mipsel = "mipsel",
  Mips32 = "mips32",
  Mips64 = "mips64",
  Mips64el = "mips64el",
  Ppc = "ppc",
  Ppc64 = "ppc64",
  Ppc64p7 = "ppc64p7",
  Ppc64le = "ppc64le",
  Riscv64 = "riscv64",
  S390 = "s390",
  S390x = "s390x",
  Sh4 = "sh4",
  Sparc = "sparc",
  Sparc64 = "sparc64",
  Sparc64v = "sparc64v",
  Sparcv8 = "sparcv8",
  Sparcv9 = "sparcv9",
  Sparcv9v = "sparcv9v",
  X86_64 = "x86_64",
  Local = "local"
}

/** possible triggers for a release of a repository */
export enum ReleaseTrigger {
  /** DEFAULT: not set, no release action possible */
  NoRelease = "no_release",
  /** only on manual commands the release gets started */
  Manual = "manual",
  /**
   * Release just once on maintenance release event. This attribute get removed
   * at the same time.
   */
  Maintenance = "maintenance"
}

export interface HostSystem {
  readonly repository: string;
  readonly project: string;
}

/**
 * Base interface of a repository (= build target) on OBS
 *
 * This interface contains the common members of the repository that is
 * extracted from OBS' API and that is presented to the user.
 */
export interface BaseRepository {
  /** Name of this repository */
  name: string;

  /** Mode in which the project is rebuilding dependencies for this repository */
  rebuild?: RebuildMode;

  /** Setting how rebuilding packages block dependent packages */
  block?: BlockMode;

  /** Setting how linked projects are rebuild */
  linkedbuild?: LinkedBuildMode;

  /** architectures which this repository builds for */
  arch?: Arch[];

  /** repositories that should be released */
  releasetarget?: ReleaseTarget[];

  /** Array of included repositories from other projects */
  path?: Path[];

  hostsystem?: HostSystem;
}

/**
 * Base type containing the common elements & attributes of a Project's and
 * Package's _meta configuration.
 */
export interface BaseMeta {
  /** Human readable description of the project or package */
  description: string;
  /** Title of the project or package */
  title: string;

  /** list of users and their roles */
  person?: User[];

  /** list of groups and their roles */
  group?: Group[];

  /** Is this project/package locked from rebuilding (used for maintenance project) */
  lock?: boolean;

  /** if set to false, then this hides the project/package from being visible */
  access?: boolean;

  /** if set to false, then this hides the source in packages and build logs */
  sourceAccess?: boolean;

  /** Url to upstream */
  url?: string;
}

/** Interface of a project's configuration (= _meta) on OBS */
export interface BaseProjectMeta extends BaseMeta {
  /** Name of the project */
  readonly name: string;

  mountProject?: string;

  /** Project type */
  kind?: Kind;

  /** links to other projects */
  link?: Link[];
}

/**
 * Non-user facing representation of the common parts of the Project and Package
 * _meta.
 */
export interface CommonMeta extends BaseMeta {
  /** building enabled/disabled for certain repositories */
  readonly build?: Flag;

  /** publishing of certain repositories enabled or disabled? */
  readonly publish?: Flag;

  /**
   * useforbuild (build results from packages will be used to build other
   * packages in contrast to external dependencies) disabled?
   */
  readonly useForBuild?: Flag;

  /** debuginfo generation settings */
  readonly debugInfo?: Flag;
}

/**
 * Representation of the part of the API reply to a `/_meta` route that is a
 * child of the `<project>` or `<package>` elements and that is common to the
 * package's and project's `_meta`.
 */
export interface CommonMetaApiReply {
  description: string;
  title: string;
  url?: string;

  build?: FlagApiReply;
  debuginfo?: FlagApiReply;
  group?: GroupApiReply[];

  lock?: SimpleFlagApiReply;

  person?: UserApiReply[];
  publish?: FlagApiReply;

  sourceaccess?: SimpleFlagApiReply;

  useforbuild?: FlagApiReply;
}

export function commonMetaFromApi(
  commonMetaApiReply: CommonMetaApiReply
): CommonMeta {
  const {
    description,
    title,
    url,
    build,
    debuginfo,
    lock,
    publish,
    sourceaccess,
    useforbuild
  } = commonMetaApiReply;
  const res: CommonMeta = {
    description,
    title,
    url,
    build: flagFromApi(build),
    debugInfo: flagFromApi(debuginfo),
    group: extractElementAsArrayIfPresent<Group>(commonMetaApiReply, "group", {
      construct: groupFromApi
    }),
    lock: lock === undefined ? undefined : simpleFlagToBoolean(lock),
    person: extractElementAsArrayIfPresent<User>(commonMetaApiReply, "person", {
      construct: userFromApi
    }),
    publish: flagFromApi(publish),
    sourceAccess:
      sourceaccess === undefined
        ? undefined
        : simpleFlagToBoolean(sourceaccess),
    useForBuild: flagFromApi(useforbuild)
  };
  return deleteUndefinedAndEmptyMembers(res);
}

export function commonMetaToApi(commonMeta: CommonMeta): CommonMetaApiReply {
  const {
    description,
    title,
    url,
    build,
    debugInfo,
    lock,
    publish,
    sourceAccess,
    useForBuild,
    person,
    group
  } = commonMeta;
  const res = {
    // order matters here! title **must** appear before description
    title,
    description,
    url,
    build: flagToApi(build),
    debuginfo: flagToApi(debugInfo),
    lock: booleanToSimpleFlag(lock),
    publish: flagToApi(publish),
    sourceaccess: booleanToSimpleFlag(sourceAccess),
    useforbuild: flagToApi(useForBuild),
    person: person?.map(pers => userToApi(pers)),
    group: group?.map(grp => groupToApi(grp))
  };
  return deleteUndefinedAndEmptyMembers(res);
}
