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

import mockFs = require("mock-fs");

import { afterEach, beforeEach, describe, it } from "mocha";
import { calculateFileHash, calculateHash } from "../src/checksum";

describe("hashes", () => {
  describe("#calculateFileHash", () => {
    let longFileContents: string = "";
    while (longFileContents.length < 10000) {
      longFileContents = longFileContents.concat(Math.random().toString());
    }

    const largeFile = Buffer.from(longFileContents);

    beforeEach(() =>
      mockFs({
        large: largeFile,
        test: `test
`
      })
    );
    afterEach(mockFs.restore);

    it("calculates the hash of a file larger than the chunksize correctly", async () => {
      await calculateFileHash("large", "md5").should.eventually.deep.equal(
        calculateHash(largeFile, "md5")
      );
    });

    it("calculates sha256sums correctly", async () => {
      await calculateFileHash("test", "sha256").should.eventually.deep.equal(
        // echo "test"|sha256sum:
        "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"
      );
    });

    it("returns undefined when the file doesn't exist", async () => {
      await calculateFileHash("does_not_exist", "md5").should.eventually.be
        .undefined;
    });
  });
});
