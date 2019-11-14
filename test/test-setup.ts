"use strict";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiThings from "chai-things";
import { Context } from "mocha";
import * as nock from "nock";
import { join } from "path";

import { Connection } from "../src/connection";

// parts of the following have been stolen from chai-nock

import { deepEqual } from "assert";
import { existsSync, readFileSync, writeFileSync } from "fs";

const config = {
  timeout: 2000
};

interface NockReply {
  body?: any;
  headers?: any;
  result?: any;
}

function equal(actual: any, expected: any): boolean {
  try {
    deepEqual(actual, expected);
    return true;
  } catch {
    return false;
  }
}

export const chaiNock: Chai.ChaiPlugin = (
  chai: Chai.ChaiStatic,
  utils: Chai.ChaiUtils
) => {
  const { Assertion } = chai;

  function promisfyNockInterceptor(
    func: () => any,
    nock: nock.Scope
  ): Promise<NockReply> {
    return new Promise(async (resolve, reject) => {
      let body: any;
      let headers: any;
      let result: any;

      const timeout = setTimeout(() => {
        reject(new Error("The request has not been recieved by Nock"));
      }, config.timeout);

      nock.once("request", ({ headers: requestHeaders }, _, reqBody) => {
        headers = requestHeaders;
        body = reqBody;
      });

      nock.once("replied", async () => {
        clearTimeout(timeout);
        if (result !== undefined && typeof result.then === "function") {
          result = await result;
        }
        resolve({ body, headers, result });
      });

      nock.on("error", err => {
        clearTimeout(timeout);
        reject(err);
      });

      result = func();
    });
  }

  // Throws a TypeError when `obj` is not a nock.Scope
  function assertIsNock(obj: any) {
    if (
      typeof obj !== "object" ||
      !obj.interceptors ||
      !obj.interceptors.length
    ) {
      throw new TypeError("You must provide a valid Nock");
    }
  }

  // function isNock(obj: any): obj is nock.Scope {
  //   return (
  //     typeof obj === "object" && obj.interceptors && obj.interceptors.length
  //   );
  // }

  // function assertGotCalled(this: Chai.AssertionStatic): void {
  //   const gotCalled: undefined | boolean = utils.flag(this, "gotCalled");
  //   if (gotCalled === undefined || !gotCalled) {
  //     throw new Error(
  //       "No request has yet been made for this scope, cannot check it yet."
  //     );
  //   }
  // }

  // expect(scope).to.be.requestedBy(func).withBody(body).and.withResult.that.deep.equals()

  Assertion.addChainableMethod("requestedBy", async function(func: () => any) {
    assertIsNock(this._obj);

    try {
      const reply = await promisfyNockInterceptor(func, this._obj);
      this._obj = reply;
      utils.flag(this, "gotCalled", true);
    } catch (err) {
      chai.assert(
        false,
        "expected Nock to have been requested, but it was never called"
      );
    }
  });

  /*Assertion.addChainableMethod("withBody", function(body: any) {
    assertGotCalled();

    const reply: NockReply = this._obj;

    this.assert(
      equal(reply.body, body),
      "expected Nock to have been requested with exact body #{exp}, but was requested with body #{act}",
      "expected Nock to have not been requested with exact body #{exp}",
      body,
      reply.body
    );
  });*/

  /*Assertion.addChainableMethod(
    "withResult",
    function(this: Chai.AssertionStatic, res: any) {
      assertGotCalled();

      const reply: NockReply = this._obj;
      new chai.Assertion(reply.result).to.be.equal(res);
    },
    function() {
      const reply: NockReply = this._obj as NockReply;
      this._obj = reply.result;
    }
  );*/

  Assertion.addMethod("requestedByWith", async function(
    func: () => any,
    arg: any
  ) {
    assertIsNock(this._obj);

    try {
      const reply = await promisfyNockInterceptor(func, this._obj);

      this._obj = reply.result;

      if (equal(reply.body, arg)) {
        return this.assert(
          true,
          "",
          "expected Nock to have not been requested with exact body #{exp}",
          arg
        );
      }
      return this.assert(
        false,
        "expected Nock to have been requested with exact body #{exp}, but was requested with body #{act}",
        "expected Nock to have not been requested with exact body #{exp}",
        arg,
        reply.body
      );
    } catch (err) {
      chai.assert(
        false,
        "expected Nock to have been requested, but it was never called"
      );
    }
  });
};

chai.use(chaiThings);

// must be the last one: https://github.com/domenic/chai-as-promised#node
chai.use(chaiAsPromised);
// except in this case: chaiNock (or more precisely our own version of it) have
// problems with it and must be loaded *after* chai-as-promised
chai.use(chaiNock);

chai.should();

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

export async function checkApiCall<T>(
  nockScope: IScope | undefined,
  apiCallingFunc: () => Promise<T> | Promise<undefined>,
  expectedReply?: T
): Promise<void> {
  let res: T | undefined;
  if (nockScope !== undefined) {
    await nockScope.scope.should.have.been
      // @ts-ignore
      .requestedByWith(
        async () => (res = await apiCallingFunc()),
        nockScope.body
      );
  } else {
    res = await apiCallingFunc().should.be.fulfilled;
  }
  chai.expect(res).to.deep.equal(expectedReply);
}
