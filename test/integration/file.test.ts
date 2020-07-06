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

import { expect } from "chai";
import { afterEach, before, beforeEach, describe } from "mocha";
import { calculateHash } from "../../src/checksum";
import { deleteFile, setFileContentsAndCommit } from "../../src/file";
import { fetchHistory } from "../../src/history";
import {
  createPackage,
  deletePackage,
  fetchFileList,
  Package
} from "../../src/package";
import {
  ApiType,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook,
  miniObsOnlyHook,
  swallowException
} from "./../test-setup";

describe("PackageFile", function () {
  before(skipIfNoMiniObsHook);

  this.timeout(10000);
  const con = getTestConnection(ApiType.MiniObs);
  let pkg: Package;

  beforeEach(async () => {
    pkg = await createPackage(
      con,
      `home:${miniObsUsername}`,
      "file_upload_test_package",
      "Package for testing the upload of files"
    );
  });

  afterEach(miniObsOnlyHook(() => swallowException(deletePackage, con, pkg)));

  const getFile = () => ({
    name: "foo.spec",
    packageName: pkg.name,
    projectName: pkg.projectName,
    modifiedTime: new Date("Thu, 01 Jan 1970 01:00:00 +0100")
  });

  describe("#setFileContentsAndCommit", () => {
    it("creates a commit without a message by default", async () => {
      const contents = Buffer.from("this is not relevant");
      const rev = await setFileContentsAndCommit(con, {
        contents,
        size: contents.length,
        md5Hash: calculateHash(contents, "md5"),
        ...getFile()
      });

      const hist = await fetchHistory(con, pkg);

      hist.should.be.an("array").and.have.length(1);
      hist[0].should.deep.equal(rev);
    });

    it("creates a commit with the specified commit message", async () => {
      const contents = Buffer.from("this is irrelevant");
      const msg = "initial version";
      const rev = await setFileContentsAndCommit(
        con,
        {
          contents,
          size: contents.length,
          md5Hash: calculateHash(contents, "md5"),
          ...getFile()
        },
        msg
      );

      expect(rev.commitMessage).to.deep.equal(msg);

      const hist = await fetchHistory(con, pkg);

      hist.should.be.an("array").and.have.length(1);
      hist[0].should.deep.equal(rev);
    });
  });

  describe("#deleteFile", () => {
    it("deletes the specified file", async () => {
      const contents = Buffer.from("a pristine file");
      const rev = await setFileContentsAndCommit(con, {
        contents,
        size: contents.length,
        md5Hash: calculateHash(contents, "md5"),
        ...getFile()
      });

      await deleteFile(con, getFile());

      const hist = await fetchHistory(con, pkg);

      hist.should.be.an("array").and.have.length(2);
      hist[0].should.deep.equal(rev);

      const [files, hash] = await fetchFileList(con, pkg);
      expect(files).to.be.an("array").and.have.length(0);
      expect(hash).to.be.a("string").and.to.deep.equal(hist[1].revisionHash);
    });
  });
});
