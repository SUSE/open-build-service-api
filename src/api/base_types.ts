/**
 * Collection of base types shared by the API module and the user facing modules
 */

import * as project from "../project";
import { Group, User } from "../user";

/** Interface of a repository (= build target) on OBS */
export interface BaseRepository {
  /** Name of this repository */
  name: string;
  /** Mode in which the project */
  rebuild?: project.RebuildMode;
  block?: project.BlockMode;
  linkedbuild?: project.LinkedBuildMode;

  /** architectures which this repository builds for */
  arch: project.Arch[];

  /** repositories that should be released */
  releasetarget: project.ReleaseTarget[];

  /** Array of included repositories from other projects */
  path: project.Path[];

  hostsystem?: project.HostSystem;
}

export interface BaseProject {
  readonly name: string;
  description: string;
  title: string;
  created?: string;
  updated?: string;
  url?: string;

  mountProject?: string;
  kind?: project.Kind;
  /** list of users and their roles belonging to this project */
  person?: User[];

  link?: project.Link[];
  /** list of groups and their roles belonging to this project */
  group?: Group[];

  // Is this project locked from rebuilding (used for maintenance project)
  lock?: boolean;

  // if set to false, then this hides the entire project from being visible
  access?: boolean;

  // if set to false, then this hides source in packages and build logs and stuff
  sourceAccess?: boolean;
}
