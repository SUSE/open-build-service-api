import { expect } from "chai";
import { describe, it } from "mocha";
import { fillPackageFileFromDirectoryEntry, PackageFile } from "../src/file";

describe("File", () => {
  describe("#fillPackageFileFromDirectoryEntry", () => {
    const testFile: PackageFile = {
      name: "foo",
      packageName: "fooPkg",
      projectName: "fooProj",
      contents: "foo",
      md5Hash: "d3b07384d113edec49eaa6238ad5ff00",
      size: 3,
      modifiedTime: new Date("1970-01-01")
    };

    it("throws an error when the directory's name is not set", () => {
      expect(() => fillPackageFileFromDirectoryEntry(testFile, {})).to.throw(
        "Cannot create a PackageFile from the DirectoryEntry: the directory name is undefined"
      );
    });

    it("does not remove the file contents", () => {
      const modified = fillPackageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      expect(modified).to.have.property("contents", testFile.contents);
    });

    it("removes the hash, size and modifiedTime, if the Directory does not contain them", () => {
      const modified = fillPackageFileFromDirectoryEntry(testFile, {
        name: "foo"
      });

      ["md5Hash", "size", "modifiedTime"].forEach(key =>
        expect(modified).to.not.have.property(key)
      );
    });
  });
});
