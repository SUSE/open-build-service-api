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

import * as assert from "assert";
import { Arch, BaseRepository, CommonMeta } from "./api/base-types";
import {
  RepositorySetting,
  repositorySettingFromFlag,
  simplifyRepositorySetting
} from "./api/flag";
import { PackageMeta } from "./api/package-meta";
import { ProjectMeta } from "./api/project-meta";
import { withoutUndefinedMembers, zip } from "./util";

/**
 * A repository where OBS' flags are expanded.
 */
export interface RepositoryWithFlags extends BaseRepository {
  /** Are packages from this repository being build */
  readonly build: RepositorySetting;
  /** Is the repository getting published */
  readonly publish: RepositorySetting;
  /**
   * Can packages from this repository be in the buildroot of other packages in
   * the repository.
   */
  readonly useForBuild: RepositorySetting;
  /** Are debugging information for this repository generated and stored */
  readonly debugInfo: RepositorySetting;
}

function getRepositoryWithFlags(
  meta: CommonMeta,
  repository: BaseRepository[],
  setDefaults: boolean = false
): RepositoryWithFlags[] {
  const { build, publish, useForBuild, debugInfo } = meta;

  const repos: RepositoryWithFlags[] = [];

  repository.forEach((repo) => {
    const arches = repo.arch ?? [];
    const newRepo: RepositoryWithFlags = {
      build: repositorySettingFromFlag(
        repo.name,
        arches,
        build,
        setDefaults ? true : undefined
      ),
      debugInfo: repositorySettingFromFlag(
        repo.name,
        arches,
        debugInfo,
        setDefaults ? false : undefined
      ),
      // don't set a default for publishing as it is disabled for branched
      // projects, but enabled everywhere else
      publish: repositorySettingFromFlag(repo.name, arches, publish),
      useForBuild: repositorySettingFromFlag(
        repo.name,
        arches,
        useForBuild,
        setDefaults ? true : undefined
      ),
      ...repo
    };

    repos.push(withoutUndefinedMembers(newRepo));
  });

  return repos;
}

function mergeFlags(
  projFlags: RepositorySetting,
  pkgFlags: RepositorySetting,
  architectures: Arch[],
  defaultSetting: boolean | undefined
): RepositorySetting {
  // the project has no preference? use the package's or the default
  if (projFlags === undefined) {
    return pkgFlags ?? defaultSetting;
  }

  // same as the above, but ensure that the package's setting has preference
  if (pkgFlags === undefined) {
    return projFlags ?? defaultSetting;
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
  const mergedFlags = new Map<Arch, boolean | undefined>();
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
  return simplifyRepositorySetting(mergedFlags);
}

// export function repositoryWithFlagsFromMeta(
//   projMeta: ProjectMeta,
//   pkgMeta?: PackageMeta
// ): RepositoryWithFlags[] | undefined;

// export function repositoryWithFlagsFromMeta(
//   repos: RepositoryWithFlags[],
//   pkgMeta: PackageMeta
// ): RepositoryWithFlags[] | undefined;

/**
 * Converts all repositories from the project's `_meta` into an array of
 * [[RepositoryWithFlags]]. If a package's `_meta` is provided as well, then the
 * resulting repositories include the per package overrides from the package's
 * `_meta`.
 */
export function repositoryWithFlagsFromMeta(
  projMeta: ProjectMeta,
  pkgMeta?: PackageMeta
): RepositoryWithFlags[] | undefined {
  const { repository } = projMeta;

  if (repository === undefined || repository.length === 0) {
    // FIXME: this forgets about flags if you set them before the repository
    return undefined;
  }

  const projRepos = getRepositoryWithFlags(
    projMeta,
    repository,
    pkgMeta === undefined
  );

  if (pkgMeta === undefined) {
    return projRepos;
  }
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
      build: mergeFlags(build, pkgBuild, architectures, true),
      publish: mergeFlags(publish, pkgPublish, architectures, undefined),
      useForBuild: mergeFlags(useForBuild, pkgUseForBuild, architectures, true),
      debugInfo: mergeFlags(debugInfo, pkgDebugInfo, architectures, false),
      ...restOfRepo
    });
  }
  return repos;
}

// export function repositoryWithFlagsFromMeta(
//   projMetaOrRepos: ProjectMeta | RepositoryWithFlags[],
//   pkgMeta?: PackageMeta
// ): RepositoryWithFlags[] | undefined {
//   if (Array.isArray(projMetaOrRepos)) {
//     assert(
//       pkgMeta !== undefined,
//       "The pkgMeta must not be undefined when using the (repos, pkgMeta) overload"
//     );
//     return _repositoryWithFlagsFromMeta(projMetaOrRepos, pkgMeta);
//   }

//   const { repository } = projMetaOrRepos;

//   if (repository === undefined || repository.length === 0) {
//     // FIXME: this forgets about flags if you set them before the repository
//     return undefined;
//   }

//   const projRepos = getRepositoryWithFlags(
//     projMetaOrRepos,
//     repository,
//     pkgMeta === undefined
//   );

//   if (pkgMeta === undefined) {
//     return projRepos;
//   }

//   return _repositoryWithFlagsFromMeta(projRepos, pkgMeta);

//   /*const pkgRepos = getRepositoryWithFlags(pkgMeta, repository);

//   const repos: RepositoryWithFlags[] = [];
//   for (const [projRepo, pkgRepo] of zip(projRepos, pkgRepos)) {
//     assert(projRepo.name === pkgRepo.name);

//     const { build, publish, useForBuild, debugInfo, ...restOfRepo } = projRepo;
//     const {
//       build: pkgBuild,
//       publish: pkgPublish,
//       useForBuild: pkgUseForBuild,
//       debugInfo: pkgDebugInfo
//     } = pkgRepo;

//     const architectures = restOfRepo.arch ?? [];

//     repos.push({
//       build: mergeFlags(build, pkgBuild, architectures, true),
//       publish: mergeFlags(publish, pkgPublish, architectures, undefined),
//       useForBuild: mergeFlags(useForBuild, pkgUseForBuild, architectures, true),
//       debugInfo: mergeFlags(debugInfo, pkgDebugInfo, architectures, false),
//       ...restOfRepo
//     });
//   }
//   return repos;*/
// }

// function _repositoryWithFlagsFromMeta(
//   projRepos: RepositoryWithFlags[],
//   pkgMeta: PackageMeta
// ): RepositoryWithFlags[] {
//   const pkgRepos = getRepositoryWithFlags(pkgMeta, projRepos);

//   const repos: RepositoryWithFlags[] = [];
//   for (const [projRepo, pkgRepo] of zip(projRepos, pkgRepos)) {
//     assert(projRepo.name === pkgRepo.name);

//     const { build, publish, useForBuild, debugInfo, ...restOfRepo } = projRepo;
//     const {
//       build: pkgBuild,
//       publish: pkgPublish,
//       useForBuild: pkgUseForBuild,
//       debugInfo: pkgDebugInfo
//     } = pkgRepo;

//     const architectures = restOfRepo.arch ?? [];

//     repos.push({
//       build: mergeFlags(build, pkgBuild, architectures, true),
//       publish: mergeFlags(publish, pkgPublish, architectures, undefined),
//       useForBuild: mergeFlags(useForBuild, pkgUseForBuild, architectures, true),
//       debugInfo: mergeFlags(debugInfo, pkgDebugInfo, architectures, false),
//       ...restOfRepo
//     });
//   }
//   return repos;
// }

/* export function flagsFromRepositoryWithFlags(
  repositories: RepositoryWithFlags[],
  proj: ProjectMeta
): Flag | undefined {
  // const { repositories, ...rest } = proj;

  if (repositories.length === 0) {
    return undefined;
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
}*/
