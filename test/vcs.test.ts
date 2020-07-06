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
import mockFs = require("mock-fs");

import { expect } from "chai";
import { describe, it } from "mocha";
import { calculateHash } from "../src/checksum";
import { FrozenPackageFile } from "../src/file";
import {
  addAndDeleteFilesFromPackage,
  FileState,
  ModifiedPackage,
  readInModifiedPackageFromDir,
  VcsFile
} from "../src/vcs";
import { setupPackageFileMock } from "./test-setup";

describe("ModifiedPackage", () => {
  const pkgBase = {
    apiUrl: "https://api.foobar.org",
    name: "fooPkg",
    projectName: "fooProj",
    md5Hash: "somethingSomethingButNotAHash"
  };

  const files: FrozenPackageFile[] = ["foo", "bar"].map((name) => ({
    name,
    packageName: pkgBase.name,
    projectName: pkgBase.projectName,
    md5Hash: calculateHash(Buffer.from(name), "md5"),
    modifiedTime: new Date(),
    contents: Buffer.from(name),
    size: 3
  }));

  describe("#readInModifiedPackageFromDir", () => {
    afterEach(() => mockFs.restore());

    it("reads in the files from .osc/_to_be_added", async () => {
      setupPackageFileMock(
        { ...pkgBase, files: [] },
        {
          additionalFiles: {
            ".osc/_to_be_added": `foo
bar
`,
            foo: "",
            bar: `bar is not empty!
`
          }
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("filesInWorkdir")
        .that.is.an("array")
        .and.has.length(2);

      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      filesInWorkdir.forEach((f) => f.state.should.equal(FileState.ToBeAdded));
      expect(filesInWorkdir.map((f) => f.name)).to.deep.equal(["foo", "bar"]);
    });

    it("reads in the files from .osc/_to_be_deleted", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files
        },
        {
          additionalFiles: {
            ".osc/_to_be_deleted": `foo
bar
`
          },
          addFilesToCwd: false
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("filesInWorkdir")
        .that.is.an("array")
        .and.has.length(2);

      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      filesInWorkdir.forEach((f) =>
        f.state.should.equal(FileState.ToBeDeleted)
      );
      expect(filesInWorkdir.map((f) => f.name)).to.deep.equal(["foo", "bar"]);
    });

    it("it adds untracked files", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files
        },
        {
          additionalFiles: {
            baz: "well, not really anything meaningful in here..."
          }
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("filesInWorkdir")
        .that.is.an("array")
        .and.has.length(3);

      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      expect(
        filesInWorkdir.find((f: VcsFile) => f.name === "baz")
      ).to.deep.include({ name: "baz", state: FileState.Untracked });
      ["foo", "bar"].forEach((unmodifiedFname) =>
        expect(
          filesInWorkdir.find((f) => f.name === unmodifiedFname)
        ).to.deep.include({
          name: unmodifiedFname,
          state: FileState.Unmodified
        })
      );
    });

    it("it marks files with different contents as modified", async () => {
      const fooContents = `nothin'
in
here
`;
      setupPackageFileMock(
        {
          ...pkgBase,
          files
        },
        {
          additionalFiles: {
            foo: fooContents,
            bar: "bar"
          },
          addFilesToCwd: false
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      expect(filesInWorkdir.find((f) => f.name === "foo")).to.deep.include({
        name: "foo",
        state: FileState.Modified,
        contents: Buffer.from(fooContents)
      });
      expect(filesInWorkdir.find((f) => f.name === "bar")).to.deep.include({
        name: "bar",
        state: FileState.Unmodified
      });
    });

    it("it finds missing files", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files
        },
        {
          addFilesToCwd: false
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("filesInWorkdir")
        .that.is.an("array")
        .and.has.length(2);

      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      ["foo", "bar"].forEach((fname) =>
        expect(filesInWorkdir.find((f) => f.name === fname)).to.deep.include({
          name: fname,
          state: FileState.Missing
        })
      );
    });

    xit("it handles deleted files that still exist sanely", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files
        },
        {
          additionalFiles: {
            ".osc/_to_be_deleted": `foo
bar
`
          },
          addFilesToCwd: true
        }
      );

      const modifiedPkg: ModifiedPackage = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("filesInWorkdir")
        .that.is.an("array")
        .and.has.length(2);

      // FIXME: which state *do* we actually expect here?
      const filesInWorkdir = modifiedPkg.filesInWorkdir;
      filesInWorkdir.forEach((f) =>
        f.state.should.equal(FileState.ToBeDeleted)
      );
      expect(filesInWorkdir.map((f) => f.name)).to.deep.equal(["foo", "bar"]);
    });
  });

  describe("#addAndDeleteFilesFromPackage", () => {
    const modifiedPkgBase = {
      apiUrl: "https://api.foo.org",
      name: "foo",
      projectName: "fooProj",
      path: "/path/to/fooProj/foo"
    };

    const dummyContents = {
      md5Hash: "irrelevant",
      contents: Buffer.from("a"),
      size: 1,
      modifiedTime: new Date()
    };

    it("rejects overlapping file additions and removals", async () => {
      await addAndDeleteFilesFromPackage(
        {
          filesInWorkdir: [],
          files: [],
          ...modifiedPkgBase
        },
        ["fileA"],
        ["fileA"]
      ).should.be.rejectedWith(/cannot.*add.*and.*remove.*file.*fileA/i);
    });

    it("rejects adding files that are not untracked", async () => {
      const missing = {
        name: "missingFile",
        projectName: modifiedPkgBase.projectName,
        packageName: modifiedPkgBase.name,
        ...dummyContents
      };
      await addAndDeleteFilesFromPackage(
        {
          filesInWorkdir: [{ ...missing, state: FileState.Missing }],
          files: [missing],
          ...modifiedPkgBase
        },
        [],
        ["missingFile"]
      ).should.be.rejectedWith(/missingFile.*not untracked/);
    });

    it("rejects removing files that are not tracked", async () => {
      const untracked = {
        name: "untrackedFile",
        projectName: modifiedPkgBase.projectName,
        packageName: modifiedPkgBase.name,
        ...dummyContents
      };
      await addAndDeleteFilesFromPackage(
        {
          filesInWorkdir: [{ ...untracked, state: FileState.Untracked }],
          files: [untracked],
          ...modifiedPkgBase
        },
        ["untrackedFile"],
        []
      ).should.be.rejectedWith(/untrackedFile.*not tracked/);
    });
  });
});
