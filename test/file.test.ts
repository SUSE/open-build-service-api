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
import { PackageFile, packageFileFromDirectoryEntry } from "../src/file";

describe("File", () => {
  describe("#packageFileFromDirectoryEntry", () => {
    const testFile: PackageFile = {
      name: "foo",
      packageName: "fooPkg",
      projectName: "fooProj",
      contents: Buffer.from("foo"),
      md5Hash: "d3b07384d113edec49eaa6238ad5ff00",
      size: 3,
      modifiedTime: new Date("1970-01-01")
    };

    it("throws an error when the directory's name is not set", () => {
      expect(() => packageFileFromDirectoryEntry(testFile, {})).to.throw(
        "Cannot create a PackageFile from the DirectoryEntry: the directory name is undefined"
      );
    });

    it("does not remove the file contents", () => {
      const modified = packageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      expect(modified).to.have.property("contents", testFile.contents);
    });

    it("removes the hash, size and modifiedTime, if the Directory does not contain them", () => {
      const modified = packageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      ["md5Hash", "size", "modifiedTime"].forEach(key =>
        expect(modified).to.not.have.property(key)
      );
    });
  });
});
