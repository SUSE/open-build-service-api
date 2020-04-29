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

import { describe, it } from "mocha";
import {
  addAndDeleteFilesFromPackage,
  FileState,
  readInModifiedPackageFromDir,
  VcsFile
} from "../src/vcs";
import { setupPackageFileMock } from "./test-setup";

describe("ModifiedPackage", () => {
  describe("#readInModifiedPackageFromDir", () => {
    afterEach(() => mockFs.restore());

    const pkgBase = {
      apiUrl: "https://api.foobar.org",
      name: "fooPkg",
      projectName: "fooProj"
    };

    it("reads in the files from .osc/_to_be_added", async () => {
      setupPackageFileMock(pkgBase, {
        additionalFiles: {
          ".osc/_to_be_added": `foo
bar
`,
          foo: "",
          bar: `bar is not empty!
`
        }
      });

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      const files = modifiedPkg.files;
      files.forEach((f: VcsFile) => f.state.should.equal(FileState.ToBeAdded));
      files.map((f: VcsFile) => f.name).should.deep.equal(["foo", "bar"]);
    });

    it("reads in the files from .osc/_to_be_deleted", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files: ["foo", "bar"].map((name) => ({
            name,
            packageName: pkgBase.name,
            projectName: pkgBase.projectName
          }))
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

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      const files = modifiedPkg.files;
      files.forEach((f: VcsFile) =>
        f.state.should.equal(FileState.ToBeDeleted)
      );
      files.map((f: VcsFile) => f.name).should.deep.equal(["foo", "bar"]);
    });

    it("it adds untracked files", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files: ["foo", "bar"].map((name) => ({
            name,
            packageName: pkgBase.name,
            projectName: pkgBase.projectName
          }))
        },
        {
          additionalFiles: {
            baz: "well, not really anything meaningful in here..."
          }
        }
      );

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(3);

      const files = modifiedPkg.files;
      files
        .find((f: VcsFile) => f.name === "baz")
        .should.deep.include({ name: "baz", state: FileState.Untracked });
      ["foo", "bar"].forEach((unmodifiedFname) =>
        files
          .find((f: VcsFile) => f.name === unmodifiedFname)
          .should.deep.include({
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
          files: ["foo", "bar"].map((name) => ({
            name,
            packageName: pkgBase.name,
            projectName: pkgBase.projectName,
            contents: Buffer.from(name)
          }))
        },
        {
          additionalFiles: {
            foo: fooContents,
            bar: "bar"
          },
          addFilesToCwd: false
        }
      );

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      const files = modifiedPkg.files;
      files
        .find((f: VcsFile) => f.name === "foo")
        .should.deep.include({
          name: "foo",
          state: FileState.Modified,
          contents: Buffer.from(fooContents)
        });
      files
        .find((f: VcsFile) => f.name === "bar")
        .should.deep.include({ name: "bar", state: FileState.Unmodified });
    });

    it("it finds missing files", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files: ["foo", "bar"].map((name) => ({
            name,
            packageName: pkgBase.name,
            projectName: pkgBase.projectName,
            contents: Buffer.from(name)
          }))
        },
        {
          addFilesToCwd: false
        }
      );

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      const files = modifiedPkg.files;
      ["foo", "bar"].forEach((fname) =>
        files
          .find((f: VcsFile) => f.name === fname)
          .should.deep.include({
            name: fname,
            state: FileState.Missing
          })
      );
    });

    xit("it handles deleted files that still exist sanely", async () => {
      setupPackageFileMock(
        {
          ...pkgBase,
          files: ["foo", "bar"].map((name) => ({
            name,
            packageName: pkgBase.name,
            projectName: pkgBase.projectName
          }))
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

      const modifiedPkg = await readInModifiedPackageFromDir(
        "."
      ).should.eventually.deep.include({
        ...pkgBase,
        path: "."
      });

      modifiedPkg.should.have
        .property("files")
        .that.is.an("array")
        .and.has.length(2);

      // FIXME: which state *do* we actually expect here?
      const files = modifiedPkg.files;
      files.forEach((f: VcsFile) =>
        f.state.should.equal(FileState.ToBeDeleted)
      );
      files.map((f: VcsFile) => f.name).should.deep.equal(["foo", "bar"]);
    });
  });

  describe("#addAndDeleteFilesFromPackage", () => {
    const modifiedPkgBase = {
      apiUrl: "https://api.foo.org",
      name: "foo",
      projectName: "fooProj",
      path: "/path/to/fooProj/foo"
    };

    it("rejects overlapping file additions and removals", async () => {
      await addAndDeleteFilesFromPackage(
        {
          files: [],
          ...modifiedPkgBase
        },
        ["fileA"],
        ["fileA"]
      ).should.be.rejectedWith(/cannot.*add.*and.*remove.*file.*fileA/i);
    });

    it("rejects adding files that are not untracked", async () => {
      await addAndDeleteFilesFromPackage(
        {
          files: [
            {
              name: "missingFile",
              projectName: modifiedPkgBase.projectName,
              packageName: modifiedPkgBase.name,
              state: FileState.Missing
            }
          ],
          ...modifiedPkgBase
        },
        [],
        ["missingFile"]
      ).should.be.rejectedWith(/missingFile.*not untracked/);
    });

    it("rejects removing files that are not tracked", async () => {
      await addAndDeleteFilesFromPackage(
        {
          files: [
            {
              name: "untrackedFile",
              projectName: modifiedPkgBase.projectName,
              packageName: modifiedPkgBase.name,
              state: FileState.Untracked
            }
          ],
          ...modifiedPkgBase
        },
        ["untrackedFile"],
        []
      ).should.be.rejectedWith(/untrackedFile.*not tracked/);
    });
  });
});
