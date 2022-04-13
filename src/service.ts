/**
 * Copyright (c) 2020-2022 SUSE LLC
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
import { Connection, RequestMethod } from "./connection";
import { BasePackage } from "./package";
import { withoutUndefinedMembers } from "./util";
import { newXmlBuilder } from "./xml";

export async function triggerServiceRun(
  con: Connection,
  projectName: string,
  pkgName: string
): Promise<void>;

export async function triggerServiceRun(
  con: Connection,
  pkg: BasePackage | Omit<BasePackage, "apiUrl">
): Promise<void>;

/**
 * Trigger a service run on a package (given either by its name & projectName or
 * via a [[BasePackage]] object).
 *
 * @param con The Connection which will be used to perform the API call. It
 *     **must** use a [[Token]] as its authentication source.
 *
 * **WARNING**
 * This function call succeeds even if the actual service run fails!
 *
 * @return A promise that resolves when a service run was triggered (this does
 *     **not** imply that the service run was successful!).
 *     It is rejected if the API call fails, for instance because the user is
 *     not authorized, the Connection does not use a token as authentication, or
 *     when the token has been created for a different package.
 */
export async function triggerServiceRun(
  con: Connection,
  projNameOrPkg: string | BasePackage | Omit<BasePackage, "apiUrl">,
  pkgName?: string
): Promise<void> {
  let projectName, packageName: string;
  if (typeof projNameOrPkg === "string") {
    assert(pkgName !== undefined);
    projectName = projNameOrPkg;
    packageName = pkgName;
  } else {
    projectName = projNameOrPkg.projectName;
    packageName = projNameOrPkg.name;
  }

  await con.makeApiCall(
    `/trigger/runservice?project=${projectName}&package=${packageName}`,
    { method: RequestMethod.POST }
  );
}

/** The modes supported by a [[Service]] */
export const enum ServiceMode {
  /**
   * Default service mode
   * The service is run after each commit on the remote, before the build locally
   * and the generated files are prefixed with `_service:`
   */
  Default = "default",

  /**
   * This mode is running the service locally. The result is committed as
   * standard files and not named with a `_service:` prefix. Additionally, the
   * service runs on the server by default. Usually the service should detect
   * that the result is the same and skip the generated files. In case they
   * differ, they are generated and added on the server.
   */
  TryLocal = "trylocal",

  /**
   * This mode is running the service locally. The result gets committed as
   * standard files and not named with `_service:` prefix. The service is never
   * running on the server side. It is also not possible to trigger it manually.
   */
  LocalOnly = "localonly",

  /**
   * Services using this mode are running on the server only. This can be
   * useful, when the service is not available or can not work on developer
   * workstations.
   * The resulting files are prefixed with `_service:`.
   */
  ServerOnly = "serveronly",

  /**
   * The service is running inside of the build job, both for local and server
   * side builds.
   * A side effect is that the service package is becoming a build
   * dependency and must be available. Every user can provide and use a service
   * this way in their projects. The generated sources are not part of the
   * source repository, but part of the generated source packages. Note that
   * services requiring external network access are likely to fail in this mode,
   * because such access is not available if the build workers are running in
   * secure mode (as is always the case at https://build.opensuse.org).
   */
  BuildTime = "buildtime",

  /**
   * The manual mode is neither running the service locally nor on the server
   * side by default.
   * It can be used to temporarily disable the service but keep the definition
   * as part of the service definition. Or it can be used to define the way how
   * to generate the sources and doing so by manually calling:
   * `osc service rundisabled`
   * The result will get committed as standard files again.
   *
   * NOTE: this mode only existed as `disabled` before OBS 2.11, but "manual" is
   * the better matching alias name for its usage and should be preferred. The
   * `osc` client may do have different behavior in future between manual and
   * disabled.
   */
  Manual = "manual",

  /** Alias for Manual */
  Disabled = "disabled"
}

export interface Service {
  readonly name: string;

  readonly mode: ServiceMode;

  toXmlObj(): ServiceXml;
}

interface ServiceXmlHeader {
  name: string;
  mode?: ServiceMode;
}

interface ParamXml {
  $: { name: string };
  _?: string;
}

function createParamXml(name: string, value?: string): ParamXml {
  return withoutUndefinedMembers({ $: { name }, _: value });
}

interface ServiceXml {
  $: ServiceXmlHeader;
  param?: ParamXml | ParamXml[];
}

function generateHeader(service: Service): ServiceXmlHeader {
  return service.mode === ServiceMode.Default
    ? { name: service.name }
    : { name: service.name, mode: service.mode };
}

export class GoModulesService implements Service {
  public readonly name = "go_modules";

  public readonly archive?: string;
  public readonly compression?: string;

  constructor(
    public readonly mode: ServiceMode = ServiceMode.Default,
    { archive, compression }: { archive?: string; compression?: string } = {}
  ) {
    this.archive = archive;
    this.compression = compression;
  }

  public toXmlObj(): ServiceXml {
    const param: ParamXml[] = [];
    if (this.archive !== undefined) {
      param.push(createParamXml("archive", this.archive));
    }
    if (this.compression !== undefined) {
      param.push(createParamXml("compression", this.compression));
    }
    return param.length > 0
      ? { $: generateHeader(this), param }
      : { $: generateHeader(this) };
  }
}

/** Types of source controls supported by the service */
export const enum ScmType {
  /** No source control is used */
  None,
  /** Git */
  Git = "git",
  /** Mercurial */
  Hg = "hg",
  /** Subversion */
  Svn = "svn",
  /** Bazaar */
  Bzr = "bzr"
}

export const enum Submodules {
  Enable = "enable",
  Master = "master",
  Disable = "disable"
}

export class ObsScmService implements Service {
  public readonly name = "obs_scm";

  public readonly user?: string;
  public readonly version?: string;
  public readonly versionformat?: string;
  public readonly versionrewrite_pattern?: string;
  public readonly versionrewrite_replacement?: string;
  public readonly versionprefix?: string;
  public readonly match_tag?: string;
  public readonly parent_tag?: string;
  public readonly revision?: string;
  public readonly filename?: string;
  public readonly extension?: string;
  public readonly exclude?: string;
  public readonly include?: string;
  public readonly extract?: string;
  public readonly package_meta?: boolean;
  public readonly history_depth?: string;
  public readonly submodules?: Submodules;
  public readonly lfs?: string;
  public readonly sslverify?: boolean;
  public readonly changesgenerate?: boolean;
  public readonly changesauthor?: string;
  public readonly encoding?: string;

  constructor(
    public readonly mode: ServiceMode = ServiceMode.Default,
    public readonly url: URL,
    public readonly scmType: ScmType,
    {
      user,
      version,
      versionformat,
      versionrewrite_pattern,
      versionrewrite_replacement,
      versionprefix,
      match_tag,
      parent_tag,
      revision,
      filename,
      extension,
      exclude,
      include,
      extract,
      package_meta,
      history_depth,
      submodules,
      lfs,
      sslverify,
      changesgenerate,
      changesauthor,
      encoding
    }: {
      user?: string;
      version?: string;
      versionformat?: string;
      versionrewrite_pattern?: string;
      versionrewrite_replacement?: string;
      versionprefix?: string;
      match_tag?: string;
      parent_tag?: string;
      revision?: string;
      filename?: string;
      extension?: string;
      exclude?: string;
      include?: string;
      extract?: string;
      package_meta?: boolean;
      history_depth?: string;
      submodules?: Submodules;
      lfs?: string;
      sslverify?: boolean;
      changesgenerate?: boolean;
      changesauthor?: string;
      encoding?: string;
    } = {}
  ) {
    this.user = user;
    this.version = version;
    this.versionformat = versionformat;
    this.versionrewrite_pattern = versionrewrite_pattern;
    this.versionrewrite_replacement = versionrewrite_replacement;
    this.versionprefix = versionprefix;
    this.match_tag = match_tag;
    this.parent_tag = parent_tag;
    this.revision = revision;
    this.filename = filename;
    this.extension = extension;
    this.exclude = exclude;
    this.include = include;
    this.extract = extract;
    this.package_meta = package_meta;
    this.history_depth = history_depth;
    this.submodules = submodules;
    this.lfs = lfs;
    this.sslverify = sslverify;
    this.changesgenerate = changesgenerate;
    this.changesauthor = changesauthor;
    this.encoding = encoding;
  }

  public toXmlObj(): ServiceXml {
    const param: ParamXml[] = [
      createParamXml("url", this.url.toString()),
      createParamXml("scm", this.scmType.toString())
    ];

    (
      [
        ["user", this.user],
        ["version", this.version],
        ["versionformat", this.versionformat],
        ["versionrewrite-pattern", this.versionrewrite_pattern],
        ["versionrewrite-replacement", this.versionrewrite_replacement],
        ["versionprefix", this.versionprefix],
        ["match-tag", this.match_tag],
        ["parent_tag", this.parent_tag],
        ["revision", this.revision],
        ["filename", this.filename],
        ["extension", this.extension],
        ["exclude", this.exclude],
        ["include", this.include],
        ["extract", this.extract],
        ["history-depth", this.history_depth],
        ["submodules", this.submodules],
        ["lfs", this.lfs],
        ["sslverify", this.sslverify],
        ["changesgenerate", this.changesgenerate],
        ["changesauthor", this.changesauthor],
        ["encoding", this.encoding]
      ] as [string, string | Submodules | boolean | undefined][]
    ).forEach(([name, value]) => {
      if (value !== undefined) {
        param.push(
          createParamXml(
            name,
            typeof value === "boolean" ? (value ? "enable" : "disable") : value
          )
        );
      }
    });

    if (this.package_meta) {
      param.push(createParamXml("package-meta", "yes"));
    }

    return { $: generateHeader(this), param };
  }
}

export function serviceToXmlString(services: Service[]): string {
  const payload = {
    services: { service: services.map((service) => service.toXmlObj()) }
  };
  return newXmlBuilder().buildObject(payload);
}

// export async function servicesFromString(
//   serviceXml: string
// ): Promise<Service[]> {
//   return newXmlParser().parseStringPromise(serviceXml);
// }

/**
 * Directory in which the service binaries reside
 */
// const SERVICE_LOCATION = "/usr/lib/obs/service";
