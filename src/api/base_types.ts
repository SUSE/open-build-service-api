// Collection of base types shared by the API module and the user facing modules

import { Project } from "../obs";
import { Group, User } from "../user";

// Interface of a repository (= build target) on OBS
export interface BaseRepository {
  name: string;
  rebuild?: Project.RebuildMode;
  block?: Project.BlockMode;
  linkedbuild?: Project.LinkedBuildMode;

  // architecture of this repository
  arch: Project.Arch[];

  // repositories that should be released
  releasetarget: Project.ReleaseTarget[];

  // Array of included repositories from other projects
  path: Project.Path[];

  hostsystem?: Project.HostSystem;
}

export interface BaseProject {
  readonly name: string;
  description: string;
  title: string;
  created?: string;
  updated?: string;
  url?: string;

  mountProject?: string;
  kind?: Project.Kind;
  // list of users and their roles belonging to this project
  person: User[];

  link: Project.Link[];
  // list of groups and their roles belonging to this project
  group: Group[];

  // Is this project locked from rebuilding (used for maintenance project)
  lock: boolean;

  // if set to false, then this hides the entire project from being visible
  access: boolean | undefined;

  // if set to false, then this hides source in packages and build logs and stuff
  sourceAccess: boolean | undefined;
}
