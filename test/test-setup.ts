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

import mockFs = require("mock-fs");

import { promises as fsPromises } from "fs";
import { AsyncFunc, Context, Func, HookFunction } from "mocha";
import * as nock from "nock";
import { tmpdir } from "os";
import { join, sep } from "path";
import { directoryToApi } from "../src/api/directory";
import { fetchProjectMeta, modifyProjectMeta } from "../src/api/project-meta";
import { Connection } from "../src/connection";
import { fileListToDirectory, FrozenPackage } from "../src/package";
import { createUnderscorePackages, Project } from "../src/project";
import { pathExists, PathType } from "../src/util";
import { newXmlBuilder } from "../src/xml";

const pathGenerator = (path: string | undefined) =>
  path === undefined
    ? (p: string): string => p
    : (p: string): string => join(path, p);

/**
 * Create the input data structure for mock-fs so that a checked out package is
 * available in `path`.
 *
 * @param pkg  The package which should be checked out.
 *
 * @param addFilesToCwd  Boolean flag whether the files of `pkg` should be added
 *     to the current working directory (i.e. the package is checked out as
 *     normal). Defaults to `true`.
 * @param path  Path to which the package should be checked out. Defaults to the
 *     current working directory.
 *
 * @return A record that can be fed directly into
 *     [`mockFs`](https://github.com/tschaub/mock-fs#mockconfig-options).
 */
export function generatePackageFileMockInput(
  pkg: FrozenPackage,
  {
    addFilesToCwd,
    path
  }: {
    addFilesToCwd?: boolean;
    path?: string;
  } = {}
): Record<string, string | Buffer> {
  const mkPath = pathGenerator(path);
  const files: { [name: string]: string | Buffer } = {};

  pkg.files?.forEach(
    (f) => (files[mkPath(`.osc/${f.name}`)] = f.contents ?? "")
  );
  if (addFilesToCwd === undefined || addFilesToCwd) {
    pkg.files?.forEach((f) => (files[mkPath(`${f.name}`)] = f.contents ?? ""));
  }

  [
    ["_apiurl", pkg.apiUrl],
    ["_osclib_version", "1.0"],
    ["_package", pkg.name],
    ["_project", pkg.projectName],
    [
      "_files",
      newXmlBuilder().buildObject(directoryToApi(fileListToDirectory(pkg)))
    ]
  ].forEach(([fname, contents]) => {
    files[mkPath(join(".osc", fname))] = `${contents}
`;
  });

  return files;
}

/**
 * Create a checked out package using mock-fs in the directory `path`.
 *
 * This function sets up a mocked file system in the current working directory
 * and creates all files necessary for it to be a valid checked out package.
 *
 * @param pkg  The package which should be checked out.
 * @param additionalFiles  A configuration object that can be passed to
 *     `mockFs()` containing additional files or directories that should be
 *     added to the mocked file system.
 * @param addFilesToCwd Boolean flag whether the files of `pkg` should be added
 *     to the current working directory (i.e. the package is checked out as
 *     normal). Defaults to true.
 * @param path  Path to which the package should be checked out. Defaults to the
 *     current working directory.
 */
export function setupPackageFileMock(
  pkg: FrozenPackage,
  {
    additionalFiles,
    addFilesToCwd,
    path
  }: {
    additionalFiles?: any;
    addFilesToCwd?: boolean;
    path?: string;
  } = {}
): void {
  mockFs({
    ...generatePackageFileMockInput(pkg, { addFilesToCwd, path }),
    ...(additionalFiles ?? {})
  });
}

export function generateProjectMockInput(
  proj: Project,
  path?: string
): Record<string, Buffer | string> {
  const mkPath = pathGenerator(path);
  const files: { [name: string]: string | Buffer } = {};

  [
    ["_project", proj.name],
    ["_packages", createUnderscorePackages(proj)],
    ["_apiurl", proj.apiUrl]
  ].forEach(([fname, contents]) => {
    files[mkPath(join(".osc", fname))] = contents;
  });

  if (proj.meta !== undefined) {
    files[mkPath(join(".osc_obs_ts", "project_meta.json"))] = JSON.stringify(
      proj.meta
    );
  }

  return files;
}

const envOrDefault = (envVar: string, defaultValue: string): string => {
  const envVarVal = process.env[envVar];
  return envVarVal === undefined ? defaultValue : envVarVal;
};

export const enum ApiType {
  Production = "https://api.opensuse.org/",
  Staging = "https://api-test.opensuse.org/",
  MiniObs = "http://localhost:3000"
}

export const miniObsUsername = "obsTestUser";
export const miniObsPassword = "nots3cr3t";

export const miniObsAdminCon = new Connection("Admin", "opensuse", {
  url: ApiType.MiniObs,
  forceHttps: false
});

export function getTestConnection(apiType: ApiType): Connection {
  return apiType === ApiType.MiniObs
    ? new Connection(miniObsUsername, miniObsPassword, {
        url: apiType,
        forceHttps: false
      })
    : new Connection(
        envOrDefault("OBS_USERNAME", "fakeUsername"),
        envOrDefault("OBS_PASSWORD", "fakePassword"),
        { url: apiType }
      );
}

export const createTemporaryDirectory = (): Promise<string> =>
  fsPromises.mkdtemp(`${tmpdir()}${sep}obs-api-wrapper`);

const SET_COOKIE = "Set-Cookie";

export async function beforeEachRecordHook(this: Context): Promise<void> {
  this.recordJsonPath = join(
    __dirname,
    "..",
    "fixtures",
    this.currentTest!.titlePath()
      .map((elem) => elem.replace(/(\s+|\/)/g, "_"))
      .join("_") + ".json"
  );

  // see: https://github.com/nock/nock/blob/3b24821a05c32a6e9a70f69fdb29fdcd68d65076/lib/back.js#L133
  nock.restore();
  nock.recorder.clear();
  nock.cleanAll();
  nock.activate();

  if ((await pathExists(this.recordJsonPath, PathType.File)) !== undefined) {
    const nockDefs = nock.loadDefs(this.recordJsonPath);
    const rawData = JSON.parse(
      await fsPromises.readFile(this.recordJsonPath, "utf8")
    );
    const extractedScopes = nock.define(nockDefs);

    this.scopes = extractedScopes.map((scopeElem: nock.Scope, i: number) => ({
      scope: scopeElem,
      body: rawData[i].body
    }));
    nock.disableNetConnect();
  } else {
    nock.enableNetConnect();
    nock.recorder.rec({
      dont_print: true,
      // never ever record headers, as they contain the test user's password!
      enable_reqheaders_recording: false,
      output_objects: true
    });
  }
}

export function beforeEachRecord(ctx: Mocha.Context): Promise<void> {
  ctx.beforeEachRecord = beforeEachRecordHook;
  return ctx.beforeEachRecord();
}

export async function afterEachRecordHook(this: Context) {
  if (this.scopes === undefined) {
    const nockCallObjects = nock.recorder.play();

    for (const nockCall of nockCallObjects) {
      if (typeof nockCall === "string") {
        return;
      }
      if ((nockCall as any).rawHeaders !== undefined) {
        const setCookieIndex = (nockCall as any).rawHeaders.indexOf(SET_COOKIE);
        if (setCookieIndex !== -1) {
          (nockCall as any).rawHeaders.splice(setCookieIndex, 2);
        }
      }
    }

    await fsPromises.writeFile(
      this.recordJsonPath,
      JSON.stringify(nockCallObjects, undefined, 4)
    );
  }
  nock.enableNetConnect();
  nock.cleanAll();
  nock.abortPendingRequests();
}

export function afterEachRecord(ctx: Mocha.Context): Promise<void> {
  ctx.afterEachRecord = afterEachRecordHook;
  return ctx.afterEachRecord();
}

export const haveMiniObs: () => boolean = () =>
  process.env.HAVE_MINI_OBS === "1";

export function skipIfNoMiniObs(ctx: Context): void | never {
  if (!haveMiniObs()) {
    ctx.skip();
  }
}

export function skipIfNoMiniObsHook(this: Context): void {
  skipIfNoMiniObs(this);
}

export function miniObsOnlyHook(hook: HookFunction): HookFunction {
  if (haveMiniObs()) {
    return hook;
  } else {
    return () => {};
  }
}

export const castToFuncT = <FC, FT>(func: (this: FC) => void): FT =>
  (func as any) as FT;

export const castToAsyncFunc = <FC>(func: (this: FC) => void): AsyncFunc =>
  castToFuncT<FC, AsyncFunc>(func);

export const castToFunc = <FC>(func: (this: FC) => void): Func =>
  castToFuncT<FC, Func>(func);

export async function swallowException(
  func: (...args: any[]) => any,
  ...args: any[]
): Promise<void> {
  try {
    await func.apply(undefined, args);
  } catch (err) {
    console.error(err.toString());
  }
}

/** Removes all repositories from the project's meta */
export async function removeProjectRepositories(
  con: Connection,
  projectName: string
): Promise<void> {
  const meta = await fetchProjectMeta(con, projectName);
  const { repository, ...rest } = meta;
  await modifyProjectMeta(con, { ...rest, repository: [] });
}

/** Converts the line endings from Unix ('\n') to Windows ('\r\n') */
export function unixToDos(str: string): string {
  return str.split("\n").join("\r\n");
}
