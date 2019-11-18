"use strict";

import { BaseProject, BaseRepository } from "./api/base_types";
import {
  RepositorySetting,
  repositorySettingFromFlag,
  repositorySettingToFlag
} from "./api/flag";
import * as api from "./api/project";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";
import {
  deleteUndefinedAndEmptyMembers,
  deleteUndefinedMembers,
  extractElementIfPresent,
  extractElementOrDefault
} from "./util";

/** Project types */
export enum Kind {
  Standard = "standard",
  Maintenance = "maintenance",
  MaintenanceIncident = "maintenance_incident",
  MaintenanceRelease = "maintenance_release"
}

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

/** Repository of another project on OBS, e.g. `openSUSE:Factory/standard` */
export interface RepositoryPath {
  /** full name of the project */
  readonly project: string;
  /** name of the repository of the other project */
  readonly repository: string;
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

// type Flag = undefined | boolean | Map<Arch, boolean | undefined>;

export interface Repository extends BaseRepository {
  readonly build?: RepositorySetting;
  readonly publish?: RepositorySetting;
  readonly useForBuild?: RepositorySetting;
  readonly debugInfo?: RepositorySetting;
}

export interface Project extends BaseProject {
  readonly repositories?: Repository[];
}

function convertFromApiProject(apiProject: api.Project): Project {
  const {
    build,
    publish,
    useForBuild,
    debugInfo,
    repository,
    ...rest
  } = apiProject;

  if (repository === undefined || repository.length === 0) {
    return deleteUndefinedAndEmptyMembers({ ...rest });
  }

  const repos: Repository[] = [];

  repository.forEach(repo => {
    const arches = repo.arch ?? [];
    const newRepo: Repository = {
      build: repositorySettingFromFlag(repo.name, arches, build),
      debugInfo: repositorySettingFromFlag(repo.name, arches, debugInfo),
      publish: repositorySettingFromFlag(repo.name, arches, publish),
      useForBuild: repositorySettingFromFlag(repo.name, arches, useForBuild),
      ...repo
    };

    repos.push(deleteUndefinedMembers(newRepo));
  });

  return deleteUndefinedAndEmptyMembers({ repositories: repos, ...rest });
}

function convertToApiProject(proj: Project): api.Project {
  const { repositories, ...rest } = proj;

  if (repositories === undefined || repositories.length === 0) {
    return deleteUndefinedAndEmptyMembers({ ...rest });
  }

  return deleteUndefinedMembers({
    build: repositorySettingToFlag(
      repositories.map(repo => [repo.name, repo.build])
    ),
    debugInfo: repositorySettingToFlag(
      repositories.map(repo => [repo.name, repo.debugInfo])
    ),
    publish: repositorySettingToFlag(
      repositories.map(repo => [repo.name, repo.publish])
    ),
    useForBuild: repositorySettingToFlag(
      repositories.map(repo => [repo.name, repo.useForBuild])
    ),
    repository: repositories.map(repo => {
      const {
        build,
        publish,
        useForBuild,
        debugInfo,
        ...commonSettings
      } = repo;
      return deleteUndefinedAndEmptyMembers({ ...commonSettings });
    }),
    ...rest
  });
}

export async function getProject(
  con: Connection,
  name: string
): Promise<Project> {
  const proj = await api.getProject(con, name);
  return convertFromApiProject(proj);
}

export async function modifyOrCreateProject(
  con: Connection,
  proj: Project
): Promise<StatusReply> {
  return api.modifyOrCreateProject(con, convertToApiProject(proj));
}

export async function deleteProject(
  con: Connection,
  proj: Project
): Promise<StatusReply> {
  const resp = await con.makeApiCall(`/source/${proj.name}`, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(resp);
}
