"use strict";

import { expect, should, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiThings from "chai-things";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { Context } from "mocha";
import * as nock from "nock";
import { join } from "path";

import { Connection } from "../src/connection";

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

    scope.on("error", err => {
      clearTimeout(timeout);
      reject(err);
    });

    resultPromise = apiCallFunc();
  });
}

use(chaiThings);

// must be the last one: https://github.com/domenic/chai-as-promised#node
use(chaiAsPromised);

should();

nock.back.fixtures = join(__dirname, "..", "fixtures");

const envOrDefault = (envVar: string, defaultValue: string): string => {
  const envVarVal = process.env[envVar];
  return envVarVal === undefined ? defaultValue : envVarVal;
};

export const enum ApiType {
  Production = "https://api.opensuse.org",
  Staging = "https://api-test.opensuse.org"
}

export function getTestConnection(apiType: ApiType): Connection {
  return new Connection(
    envOrDefault("OBS_USERNAME", "fakeUsername"),
    envOrDefault("OBS_PASSWORD", "fakePassword"),
    apiType
  );
}

export async function beforeEachRecorded(this: Context) {
  const jsonPath =
    this.currentTest!.titlePath()
      .map(elem => elem.replace(/\s+/g, "_"))
      .join("_") + ".json";

  nock.back.setMode("record");
  const { nockDone } = await nock.back(jsonPath);
  this.nockDone = nockDone;
}

export function afterEachRecorded(this: Context) {
  this.nockDone();
  nock.back.setMode("wild");
}

export interface IScope {
  scope: nock.Scope;
  body: string;
}

export function beforeEachRecord(this: Context) {
  this.recordJsonPath = join(
    __dirname,
    "..",
    "fixtures",
    this.currentTest!.titlePath()
      .map(elem => elem.replace(/\s+/g, "_"))
      .join("_") + ".json"
  );

  if (existsSync(this.recordJsonPath)) {
    const nockDefs = nock.loadDefs(this.recordJsonPath);
    const rawData = JSON.parse(readFileSync(this.recordJsonPath).toString());
    const extractedScopes = nock.define(nockDefs);
    this.scopes = extractedScopes.map((scopeElem: nock.Scope, i: number) => {
      return { scope: scopeElem, body: rawData[i].body };
    });
  } else {
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
    writeFileSync(
      this.recordJsonPath,
      JSON.stringify(nockCallObjects, undefined, 4)
    );
  }
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
