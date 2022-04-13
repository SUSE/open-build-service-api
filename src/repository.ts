/**
 * Copyright (c) 2019-2022 SUSE LLC
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
import { Arch, BaseRepository, CommonMeta, Path } from "./api/base-types";
import {
  applyDefaultSetting,
  RepositorySetting,
  repositorySettingFromFlag,
  RepositorySettingWithoutDefaults,
  simplifyRepositorySetting
} from "./api/flag";
import { PackageMeta } from "./api/package-meta";
import { fetchProjectMeta, ProjectMeta } from "./api/project-meta";
import { Connection } from "./connection";
import { BaseProject } from "./project";
import { withoutUndefinedMembers, zip } from "./util";

const DEBUG_INFO_DEFAULT = false;
const PUBLISH_DEFAULT = true;
const USE_FOR_BUILD_DEFAULT = true;
const BUILD_DEFAULT = true;

type RepositoryWithFlagType<T> = BaseRepository & {
  /** Are packages from this repository being build */
  readonly build: T;
  /** Is the repository getting published */
  readonly publish: T;
  /**
   * Can packages from this repository be in the buildroot of other packages in
   * the repository.
   */
  readonly useForBuild: T;
  /** Are debugging information for this repository generated and stored */
  readonly debugInfo: T;
};

/**
 * A repository where OBS' flags are expanded.
 */
export type RepositoryWithFlags = RepositoryWithFlagType<RepositorySetting>;

type RepositoryWithNonDefaultFlags =
  RepositoryWithFlagType<RepositorySettingWithoutDefaults>;

interface SetDefaultsOption {
  setDefaults: boolean;
}

function getRepositoryWithFlags(
  meta: CommonMeta,
  repository: BaseRepository[],
  setDefaults: { setDefaults: true }
): RepositoryWithFlags[];

function getRepositoryWithFlags(
  meta: CommonMeta,
  repository: BaseRepository[],
  setDefaults?: SetDefaultsOption
): RepositoryWithNonDefaultFlags[];

function getRepositoryWithFlags(
  meta: CommonMeta,
  repository: BaseRepository[],
  setDefaults?: SetDefaultsOption
): RepositoryWithNonDefaultFlags[] {
  const { build, publish, useForBuild, debugInfo } = meta;

  const repos: RepositoryWithNonDefaultFlags[] = [];

  repository.forEach((repo) => {
    const arches = repo.arch ?? [];
    const newRepo: RepositoryWithNonDefaultFlags = {
      build: repositorySettingFromFlag(repo.name, arches, build, {
        defaultSetting: setDefaults?.setDefaults ? BUILD_DEFAULT : undefined
      }),
      debugInfo: repositorySettingFromFlag(repo.name, arches, debugInfo, {
        defaultSetting: setDefaults?.setDefaults
          ? DEBUG_INFO_DEFAULT
          : undefined
      }),
      publish: repositorySettingFromFlag(repo.name, arches, publish, {
        defaultSetting: setDefaults?.setDefaults ? PUBLISH_DEFAULT : undefined
      }),
      useForBuild: repositorySettingFromFlag(repo.name, arches, useForBuild, {
        defaultSetting: setDefaults?.setDefaults
          ? USE_FOR_BUILD_DEFAULT
          : undefined
      }),
      ...repo
    };

    repos.push(withoutUndefinedMembers(newRepo));
  });

  return repos;
}

function mergeFlags(
  projFlags: RepositorySettingWithoutDefaults,
  pkgFlags: RepositorySettingWithoutDefaults,
  architectures: Arch[],
  defaultSetting: boolean
): RepositorySetting {
  // the project has no preference? use the package's or the default
  if (projFlags === undefined) {
    return applyDefaultSetting(pkgFlags, defaultSetting);
  }

  // same as the above, but ensure that the package's setting has preference
  if (pkgFlags === undefined) {
    return applyDefaultSetting(projFlags, defaultSetting);
  }

  // if the package flags are a boolean, then they override anything that could
  // come from the project
  if (typeof pkgFlags === "boolean") {
    return pkgFlags;
  }

  // the most interesting case:
  // package has per arch settings and the project has either per arch settings
  // or a global setting
  // => the package's flags take precedence and if it has no setting we use the
  //    project's (either the per arch or global switch) or the default
  const mergedFlags = new Map<Arch, boolean>();
  for (const arch of architectures) {
    const flag = pkgFlags.get(arch);

    if (flag === undefined) {
      const flagFromProj =
        typeof projFlags === "boolean" ? projFlags : projFlags.get(arch);
      mergedFlags.set(arch, flagFromProj ?? defaultSetting);
    } else {
      mergedFlags.set(arch, flag);
    }
  }
  return applyDefaultSetting(
    simplifyRepositorySetting(mergedFlags),
    defaultSetting
  );
}

/**
 * Converts all repositories from the project's `_meta` into an array of
 * [[RepositoryWithFlags]]. If a package's `_meta` is provided as well, then the
 * resulting repositories include the per package overrides from the package's
 * `_meta`.
 */
export function repositoryWithFlagsFromMeta(
  projMeta: ProjectMeta,
  pkgMeta?: PackageMeta
): RepositoryWithFlags[] {
  const { repository } = projMeta;

  if (repository === undefined || repository.length === 0) {
    // FIXME: this forgets about flags if you set them before the repository
    return [];
  }

  const setDefaults = pkgMeta === undefined;
  // we have to do this weird duplication of calling getRepositoryWithFlags
  // twice because the typescript compiler is not smart enough to remember that
  // `setDefaults` is true unless there is a branch
  if (setDefaults) {
    return getRepositoryWithFlags(projMeta, repository, {
      setDefaults
    });
  }

  const projRepos = getRepositoryWithFlags(projMeta, repository, {
    setDefaults
  });

  const pkgRepos = getRepositoryWithFlags(pkgMeta, repository);

  const repos: RepositoryWithFlags[] = [];
  for (const [projRepo, pkgRepo] of zip(projRepos, pkgRepos)) {
    assert(projRepo.name === pkgRepo.name);

    const { build, publish, useForBuild, debugInfo, ...restOfRepo } = projRepo;
    const {
      build: pkgBuild,
      publish: pkgPublish,
      useForBuild: pkgUseForBuild,
      debugInfo: pkgDebugInfo
    } = pkgRepo;

    const architectures = restOfRepo.arch ?? [];

    repos.push({
      build: mergeFlags(build, pkgBuild, architectures, BUILD_DEFAULT),
      publish: mergeFlags(publish, pkgPublish, architectures, PUBLISH_DEFAULT),
      useForBuild: mergeFlags(
        useForBuild,
        pkgUseForBuild,
        architectures,
        USE_FOR_BUILD_DEFAULT
      ),
      debugInfo: mergeFlags(
        debugInfo,
        pkgDebugInfo,
        architectures,
        DEBUG_INFO_DEFAULT
      ),
      ...restOfRepo
    });
  }
  return repos;
}

/**
 * Fetch the paths of the specified project and repository and recursively
 * expand the last path entry in the same way as OBS does.
 *
 * When specifying repository paths, OBS will automatically include all
 * repositories of the **last** path in the repository in your current project
 * (this recurses until there are no more paths to be included). This function
 * performs the same expansion and returns the recursively expanded paths.
 *
 * If the project has no defined repositories or no repository that has the
 * supplied `repositoryName`, then an empty array is returned.
 */
export async function fetchProjectsPathsRecursively(
  con: Connection,
  project: string | BaseProject,
  repositoryName: string
): Promise<Path[]> {
  const projectName = typeof project === "string" ? project : project.name;
  const meta = await fetchProjectMeta(con, projectName);
  const foundRepo = meta.repository?.find(
    (repo) => repo.name === repositoryName
  );
  if (foundRepo === undefined) {
    return [];
  }

  const paths: Path[] = [{ project: projectName, repository: repositoryName }];

  if (foundRepo.path === undefined || foundRepo.path.length === 0) {
    return paths;
  }
  paths.push(...foundRepo.path.slice(0, foundRepo.path.length - 1));
  const lastPath = foundRepo.path[foundRepo.path.length - 1];
  paths.push(
    ...(await fetchProjectsPathsRecursively(
      con,
      lastPath.project,
      lastPath.repository
    ))
  );
  return paths;
}
