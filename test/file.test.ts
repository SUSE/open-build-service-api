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
import { describe, it } from "mocha";
import {
  FrozenPackageFile,
  PackageFile,
  packageFileFromDirectoryEntry
} from "../src/file";
import { calculateHash } from "../src/checksum";

describe("File", () => {
  describe("#packageFileFromDirectoryEntry", () => {
    const testFile: FrozenPackageFile = {
      name: "foo",
      packageName: "fooPkg",
      projectName: "fooProj",
      contents: Buffer.from("fooooooooooooo"),
      md5Hash: "d3b07384d113edec49eaa6238ad5ff00",
      size: 3,
      modifiedTime: new Date("1970-01-01")
    };

    it("throws an Error when the directory's name is not set", () => {
      expect(() => packageFileFromDirectoryEntry(testFile, {})).to.throw(
        Error,
        /file name.*and directory name.*do not match/i
      );
    });

    it("does not remove the file contents", () => {
      const modified = packageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      expect(modified).to.have.property("contents", testFile.contents);
    });

    it("reuses the hash and modifiedTime, if the Directory does not contain them", () => {
      const modified = packageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      ["md5Hash", "modifiedTime"].forEach((key) =>
        expect(modified)
          .to.have.property(key)
          .that.equals(testFile[key as keyof PackageFile])
      );
    });

    it("takes the new directory entries size from provided size", () => {
      packageFileFromDirectoryEntry(testFile, {
        name: "foo",
        size: 16
      })
        .should.have.property("size")
        .that.equals(16);
    });

    it("takes the new package file size from the old package", () => {
      packageFileFromDirectoryEntry(testFile, {
        name: "foo",
        md5: "something"
      })
        .should.have.property("size")
        .that.equals(testFile.size);
    });

    it("takes the new package file size from the old package's contents", () => {
      const { size, ...rest } = testFile;
      packageFileFromDirectoryEntry(rest, {
        name: "foo",
        md5: "something"
      })
        .should.have.property("size")
        .that.equals(testFile.contents!.length);
    });

    it("takes the md5Hash from the directory at first", () => {
      packageFileFromDirectoryEntry(testFile, {
        name: "foo",
        md5: "I go first"
      })
        .should.have.property("md5Hash")
        .that.equals("I go first");
    });

    it("takes the md5Hash from the file if not in the directory", () => {
      packageFileFromDirectoryEntry(testFile, {
        name: "foo"
      })
        .should.have.property("md5Hash")
        .that.equals(testFile.md5Hash);
    });

    it("calculates the md5hash from the file contents if not present in the directory or the file", () => {
      const { md5Hash, ...rest } = testFile;
      packageFileFromDirectoryEntry(rest, {
        name: "foo"
      })
        .should.have.property("md5Hash")
        .that.equals(calculateHash(testFile.contents!, "md5"));
    });
  });
});
