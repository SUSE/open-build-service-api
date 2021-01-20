/**
 * Copyright (c) 2020 SUSE LLC
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

import { describe, it } from "mocha";
import { Connection } from "../../src/connection";
import { ApiError } from "../../src/error";
import {
  packageFileFromBuffer,
  setFileContentsAndCommit
} from "../../src/file";
import { createPackage, deletePackage } from "../../src/package";
import {
  GoModulesService,
  serviceToXmlString,
  triggerServiceRun
} from "../../src/service";
import { createToken, deleteToken, Token } from "../../src/token";
import {
  ApiType,
  castToAsyncFunc,
  getMiniObsUrl,
  getTestConnection,
  miniObsOnlyHook,
  miniObsUsername,
  skipIfNoMiniObs
} from "../test-setup";
import Mocha = require("mocha");

type ServiceCtx = { token: Token; tokenCon: Connection } & Mocha.Context;

describe("Service", function () {
  this.timeout(5000);
  const con = getTestConnection(ApiType.MiniObs);

  before(
    castToAsyncFunc<ServiceCtx>(async function () {
      skipIfNoMiniObs(this);
      this.token = await createToken(con, miniObsUsername);
      this.tokenCon = new Connection(this.token, {
        url: getMiniObsUrl(),
        forceHttps: false
      });
    })
  );

  after(
    miniObsOnlyHook(
      castToAsyncFunc<ServiceCtx>(function () {
        return deleteToken(con, this.token);
      })
    )
  );

  const testPkg = {
    name: "test_package",
    projectName: `home:${miniObsUsername}`
  };

  beforeEach(() => createPackage(con, testPkg.projectName, testPkg.name));

  afterEach(() => deletePackage(con, testPkg.projectName, testPkg.name));

  describe("#triggerServiceRun", () => {
    it(
      "runs a remote service",
      castToAsyncFunc<ServiceCtx>(async function () {
        await setFileContentsAndCommit(
          con,
          packageFileFromBuffer(
            "_service",
            testPkg.name,
            testPkg.projectName,
            serviceToXmlString([new GoModulesService()])
          )
        );

        await triggerServiceRun(this.tokenCon, testPkg).should.be.fulfilled;
      })
    );

    it(
      "it rejects the promise if the package has no _service",
      castToAsyncFunc<ServiceCtx>(async function () {
        await triggerServiceRun(this.tokenCon, testPkg).should.be.rejectedWith(
          ApiError,
          /no source service defined/i
        );
      })
    );

    it(
      "it rejects the promise if the Connection is not using a Token",
      castToAsyncFunc<ServiceCtx>(async function () {
        await triggerServiceRun(con, testPkg).should.be.rejectedWith(
          ApiError,
          /no valid token found/i
        );
      })
    );
  });
});
