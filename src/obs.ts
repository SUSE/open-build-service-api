"use strict";

import { extractElementIfPresent, extractElementOrDefault } from "./util";

import { Connection } from "./connection";
import { BaseRepository, BaseProject } from "./api/base_types";
import * as api from "./api/project";

/*function getElementOrDefaultMarkerIfPresent<IT, MT>(
    data: any,
    key: string,
    is_default: (...args: any[]) => boolean,
    default_marker: MT
): IT | MT | undefined {
    if (!(key in data)) {
        return undefined;
    }
    if (is_default(key[data])) {
        return default_marker;
    }
    return data[key];
}*/

export namespace User {
  // roles of a Person or a Group belonging to a project
  export const enum LocalRole {
    Maintainer = "maintainer",
    Bugowner = "bugowner",
    Reviewer = "reviewer",
    Downloader = "downloader",
    Reader = "reader"
  }

  // A user belonging to a project
  export class User {
    readonly user_id: string;
    readonly role: LocalRole;

    constructor(data: { $: { userid: string; role: LocalRole } }) {
      this.user_id = data.$.userid;
      this.role = data.$.role;
    }
  }

  // A group belonging to a project
  export class Group {
    readonly group_id: string;
    readonly role: LocalRole;

    constructor(data: { $: { groupid: string; role: LocalRole } }) {
      this.group_id = data.$.groupid;
      this.role = data.$.role;
    }
  }
}

export namespace Project {
  // Project types
  export const enum Kind {
    Standard = "standard",
    Maintenance = "maintenance",
    MaintenanceIncident = "maintenance_incident",
    MaintenanceRelease = "maintenance_release"
  }

  // Possible modes/policies used by OBS when to rebuild packages
  export const enum RebuildMode {
    // DEFAULT: build on source change and all depending packages including
    // indirect dependencies
    Transitive = "transitive",
    // build on source change and direct depending packages
    Direct = "direct",
    // build on source change only
    Local = "local"
  }

  // Possible modes how packages will be blocked from rebuilding on dependency
  // changes
  export const enum BlockMode {
    // DEFAULT: block until all packages we depend on are built
    All = "all",
    // like all, but ignore packages from other repositories
    Local = "local",
    // immediately start building the packages
    Never = "never"
  }

  // Rebuild policy for linked projects
  export const enum LinkedBuildMode {
    // DEFAULT: do not build packages from project links
    Off = "off",
    // only build project linked packages if they depend on a local package
    LocalDep = "localdep",
    // treat packages from project links like local packages
    All = "all"
  }
}

export namespace Project {
  export class ReleaseTarget {
    readonly project: string;
    readonly repository: string;
    readonly trigger: Project.ReleaseTrigger;

    constructor(data: {
      $: {
        project: string;
        repository: string;
        trigger?: Project.ReleaseTrigger;
      };
    }) {
      this.project = data.$.project;
      this.repository = data.$.repository;
      this.trigger = extractElementOrDefault(
        data.$,
        "trigger",
        Project.ReleaseTrigger.NoRelease
      );
    }
  }

  // Path to a repository of a project in the Open Build Service.
  //
  // E.g. to refer to `openSUSE:Factory/standard`:
  // { project: "openSUSE:Factory", repository: "standard" }
  export class Path {
    // Name of the project, which repository we want to reference
    readonly project: string;
    // Name of the repository in the given project
    readonly repository: string;

    constructor(data: { $: { repository: string; project: string } }) {
      this.repository = data.$.repository;
      this.project = data.$.project;
    }
  }

  export const enum VrevMode {
    Standard = "standard",
    Unextend = "unextend",
    Extend = "extend"
  }

  export class Link {
    readonly vrevmode: VrevMode;
    readonly project: string;

    constructor(data: { vrevmode?: VrevMode; project: string }) {
      let vrevmode = extractElementIfPresent<VrevMode>(data, "vrevmode");
      if (vrevmode === undefined) {
        vrevmode = VrevMode.Standard;
      }

      this.project = data.project;
      this.vrevmode = vrevmode;
    }
  }

  // Architectures supported by OBS
  export const enum Arch {
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

  // Repository of another project on OBS
  export interface RepositoryPath {
    // full name of the project
    readonly project: string;
    // name of the repository of the project
    readonly repository: string;
  }

  // possible triggers for a release of a repository
  export const enum ReleaseTrigger {
    // DEFAULT: not set, no release action possible
    NoRelease = "no_release",
    // only on manual commands the release gets started
    manual = "manual",
    // Release just once on maintenance release event. This attribute get removed
    // at the same time
    Maintenance = "maintenance"
  }

  export interface HostSystem {
    readonly repository: string;
    readonly project: string;
  }

  type Flag = undefined | boolean | Map<Arch, boolean | undefined>;

  export interface Repository extends BaseRepository {
    readonly build: Flag;
    readonly publish: Flag;
    readonly useForBuild: Flag;
    readonly debugInfo: Flag;
  }

  export interface Project extends BaseProject {
    readonly repositories: Array<Repository>;
  }

  function convertFromApiProject(apiProject: api.Project): Project {
    let {
      build,
      publish,
      useforbuild,
      debuginfo,
      repository,
      ...res
    } = apiProject;

    let repos: Array<Repository> = [];
    if (repository !== undefined) {
      repository.forEach(repo => {
        const arches = repo.arch;
        repos.push({
          build: api.projectSettingFromFlag(repo.name, arches, build),
          publish: api.projectSettingFromFlag(repo.name, arches, publish),
          useForBuild: api.projectSettingFromFlag(
            repo.name,
            arches,
            useforbuild
          ),
          debugInfo: api.projectSettingFromFlag(repo.name, arches, debuginfo),
          ...repo
        });
      });
    }

    return { repositories: repos, ...res };
  }

  export async function getProject(
    con: Connection,
    name: string
  ): Promise<Project> {
    const proj = await api.getProject(con, name);
    return convertFromApiProject(proj);
  }
}

// class Package {}

// class File {}
