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

import { beforeEach, describe, it } from "mocha";
import * as nock from "nock";
import { normalizeUrl } from "../../src/connection";
import { searchForProjects } from "../../src/search";
import { ApiType, getTestConnection } from "../test-setup";

describe("search", function () {
  this.timeout(5000);

  nock.back.setMode("record");

  beforeEach(function () {
    this.con = getTestConnection(ApiType.Production);
  });

  describe("#searchForProjects", function () {
    it("finds a home project", async function () {
      const { nockDone, context } = await nock.back("search_for_project.json", {
        recorder: { dont_print: false, logging: console.log }
      });
      console.log(context);
      console.log(nock.back.fixtures);

      await searchForProjects(this.con, "home:dancermak", {
        idOnly: true,
        exactMatch: true
      }).should.eventually.deep.equal([
        {
          name: "home:dancermak",
          apiUrl: normalizeUrl(ApiType.Production)
        }
      ]);

      nockDone();
    });
  });
});
