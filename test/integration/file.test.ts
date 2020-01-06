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

import { afterEach, beforeEach, describe, it } from "mocha";
import { fetchFileHistory } from "./../../src/file";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";
import {
  vagrantSshfsDotChanges,
  vagrantSshfsDotChangesFileHistory,
  vagrantSshfsHistory
} from "./data";

describe("File", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  describe("#fetchFileHistory", () => {
    it("fetches the full history of the file", async () => {
      vagrantSshfsDotChanges.should.not.have.property("history");
      await fetchFileHistory(
        con,
        vagrantSshfsDotChanges
      ).should.be.fulfilled.and.eventually.deep.equal(
        vagrantSshfsDotChangesFileHistory
      );
      vagrantSshfsDotChanges.should.not.have.property("history");
    });

    it("fetches the history of the file at specific revisions", async () => {
      await fetchFileHistory(
        con,
        vagrantSshfsDotChanges,
        vagrantSshfsHistory.slice(0, 3)
      ).should.be.fulfilled.and.eventually.deep.equal(
        vagrantSshfsDotChangesFileHistory.slice(0, 3)
      );
    });
  });
});
