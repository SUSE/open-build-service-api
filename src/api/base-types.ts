/**
 * Collection of base types shared by the API module and the user facing modules
 */

import * as projectMeta from "../project-meta";
import { Group, User } from "../user";

/** Interface of a repository (= build target) on OBS */
export interface BaseRepository {
  /** Name of this repository */
  name: string;
  /** Mode in which the project is rebuilding dependencies for this repository */
  rebuild?: projectMeta.RebuildMode;
  block?: projectMeta.BlockMode;
  linkedbuild?: projectMeta.LinkedBuildMode;

  /** architectures which this repository builds for */
  arch?: projectMeta.Arch[];

  /** repositories that should be released */
  releasetarget?: projectMeta.ReleaseTarget[];

  /** Array of included repositories from other projects */
  path?: projectMeta.Path[];

  hostsystem?: projectMeta.HostSystem;
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
}

/** Interface of a project's configuration (= meta) on OBS */
export interface BaseProjectMeta extends BaseMeta {
  /** Name of the project */
  readonly name: string;
  /** Url to upstream */
  url?: string;

  mountProject?: string;

  /** Project type */
  kind?: projectMeta.Kind;

  /** links to other projects */
  link?: projectMeta.Link[];
}
