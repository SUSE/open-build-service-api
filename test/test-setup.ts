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

import { expect, should, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiThings from "chai-things";
import * as sinonChai from "sinon-chai";
import { promises as fsPromises, readFileSync, writeFileSync } from "fs";
import { AsyncFunc, Context, Func } from "mocha";
import * as nock from "nock";
import { tmpdir } from "os";
import { join, sep } from "path";
import { directoryToApi } from "../src/api/directory";
import { Connection } from "../src/connection";
import { fileListToDirectory, FrozenPackage } from "../src/package";
import { pathExists, PathType } from "../src/util";
import { newXmlBuilder } from "../src/xml";

/**
 * Create a checked out package using mock-fs in the current working directory.
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
 */
export function setupPackageFileMock(
  pkg: FrozenPackage,
  {
    additionalFiles,
    addFilesToCwd
  }: {
    additionalFiles?: any;
    addFilesToCwd?: boolean;
  } = {}
): void {
  const files: {
    [name: string]: string | Buffer;
  } = {};
  pkg.files?.forEach((f) => (files[`.osc/${f.name}`] = f.contents ?? ""));
  if (addFilesToCwd === undefined || addFilesToCwd) {
    pkg.files?.forEach((f) => (files[`${f.name}`] = f.contents ?? ""));
  }

  mockFs({
    ".osc/_apiurl": `${pkg.apiUrl}
`,
    ".osc/_osclib_version": "1.0",
    ".osc/_package": `${pkg.name}
`,
    ".osc/_project": `${pkg.projectName}
`,
    ".osc/_files": newXmlBuilder().buildObject(
      directoryToApi(fileListToDirectory(pkg))
    ),
    ...files,
    ...(additionalFiles ?? {})
  });
}

/** Payload that has been extracted from the nock and received from the API call */
interface InterceptedApiCall<T> {
  /** body of the request */
  body?: any;
  /** headers of the request */
  headers?: any;
  /**
   * Return value of the called function.
   * This value is only set if the function actually returned something and
   * didn't throw an exception.
   */
  result?: T;
  /**
   * An error that has been thrown by the API calling function.
   *
   * If this value is set, then result **must** be undefined.
   */
  error?: Error;
}

/**
 * Performs an API call via a the function `apiCallFunc` with the setup `scope`.
 *
 * The function configures the nock before calling `apiCallFunc` and awaiting
 * its result. If awaiting the function succeeds, then the result is saved in
 * the field [[InterceptedApiCall.result]]. If an `Error` is thrown, then the
 * error is saved in the returned object.
 *
 * @param timeoutMs  Timeout in milliseconds for the scope to be accessed before
 *     the promise is rejected.
 */
function makeApiCallWithNockIntercept<T>(
  apiCallFunc: () => Promise<T>,
  scope: nock.Scope,
  timeoutMs: number = 2000
): Promise<InterceptedApiCall<T>> {
  // more or less stolen from chai-nock's promisfyNockInterceptor
  return new Promise(async (resolve, reject) => {
    let body: any;
    let headers: any;
    let resultPromise: Promise<T>;

    const timeout = setTimeout(() => {
      reject(new Error("The request has not been recieved by Nock"));
    }, timeoutMs);

    scope.once("request", ({ headers: requestHeaders }, _, reqBody) => {
      headers = requestHeaders;
      body = reqBody;
    });

    scope.once("replied", async () => {
      clearTimeout(timeout);
      try {
        const result = await resultPromise;
        resolve({ body, headers, result });
      } catch (error) {
        resolve({ body, headers, error });
      }
    });

    scope.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    resultPromise = apiCallFunc();
  });
}

use(chaiThings);
use(sinonChai);

// must be the last one: https://github.com/domenic/chai-as-promised#node
use(chaiAsPromised);

should();

const envOrDefault = (envVar: string, defaultValue: string): string => {
  const envVarVal = process.env[envVar];
  return envVarVal === undefined ? defaultValue : envVarVal;
};

export const enum ApiType {
  Production = "https://api.opensuse.org",
  Staging = "https://api-test.opensuse.org",
  MiniObs = "http://localhost:3000"
}

export const miniObsUsername = "obsTestUser";
export const miniObsPassword = "nots3cr3t";

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

interface IScope {
  scope: nock.Scope;
  body: string;
}

const SET_COOKIE = "Set-Cookie";

export async function beforeEachRecord(this: Context): Promise<void> {
  this.recordJsonPath = join(
    __dirname,
    "..",
    "fixtures",
    this.currentTest!.titlePath()
      .map((elem) => elem.replace(/(\s+|\/)/g, "_"))
      .join("_") + ".json"
  );

  // see: https://github.com/nock/nock/blob/master/lib/back.js#L180
  nock.restore();
  nock.recorder.clear();
  nock.cleanAll();
  nock.activate();

  if ((await pathExists(this.recordJsonPath, PathType.File)) !== undefined) {
    const nockDefs = nock.loadDefs(this.recordJsonPath);
    const rawData = JSON.parse(readFileSync(this.recordJsonPath).toString());
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

export function afterEachRecord(this: Context) {
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

    writeFileSync(
      this.recordJsonPath,
      JSON.stringify(nockCallObjects, undefined, 4)
    );
  }
  nock.enableNetConnect();
}

export async function checkApiCallSucceeds<T>(
  nockScope: IScope | undefined,
  apiCallFunc: () => Promise<T>,
  timeoutMs: number = 2000
): Promise<T> {
  let res: T | undefined;

  if (nockScope !== undefined) {
    const intercepted = await makeApiCallWithNockIntercept(
      apiCallFunc,
      nockScope.scope,
      timeoutMs
    );

    expect(intercepted.body).to.deep.equal(nockScope.body);

    res = intercepted.result;
  } else {
    res = await apiCallFunc();
  }

  // FIXME: what should we do if apiCallFunc() returns Promise<void>?
  return res!;
}

export async function checkApiCallFails<T>(
  nockScope: IScope | undefined,
  apiCallFunc: () => Promise<T>,
  timeoutMs: number = 2000
): Promise<Error> {
  if (nockScope !== undefined) {
    const intercepted = await makeApiCallWithNockIntercept(
      apiCallFunc,
      nockScope.scope,
      timeoutMs
    );

    expect(intercepted.result).to.be.undefined;
    expect(intercepted.error).to.not.be.undefined;

    return intercepted.error!;
  } else {
    let failed = true;
    try {
      await apiCallFunc();
      failed = false;
    } catch (err) {
      return err;
    }

    // if we reach this, then call to apiCallFunc() was successful, but it
    // shouldn't have been, so this always triggers an assertion and never
    // actually returns anything
    return expect(failed).to.be.true(
      "calling apiCallFunc() should have failed"
    ) as never;
  }
}

export function skipIfNoMiniObs(ctx: Context): void {
  if (process.env.HAVE_MINI_OBS === undefined) {
    ctx.skip();
  }
}

export function skipIfNoMiniObsHook(this: Context): void {
  skipIfNoMiniObs(this);
}

export const castToFuncT = <FC, FT>(func: (this: FC) => void): FT =>
  (func as any) as FT;

export const castToAsyncFunc = <FC>(func: (this: FC) => void): AsyncFunc =>
  castToFuncT<FC, AsyncFunc>(func);

export const castToFunc = <FC>(func: (this: FC) => void): Func =>
  castToFuncT<FC, Func>(func);
