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
import { DefaultValue } from "../../src/api/flag";
import {
  fetchPackageMeta,
  PackageMeta,
  setPackageMeta
} from "../../src/api/package-meta";
import { ApiError } from "../../src/error";
import { deletePackage } from "../../src/package";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook,
  miniObsOnlyHook,
  swallowException
} from "./../test-setup";

describe("#fetchPackageMeta", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("gets a package _meta", async () => {
    const [project, name] = ["devel:tools", "gcovr"];
    await fetchPackageMeta(con, project, name).should.eventually.deep.equal({
      name,
      project,
      title: "A code coverage report generator using GNU gcov",
      description: `Gcovr provides a utility for managing the use of the GNU gcov utility
and generating summarized code coverage results.

This command is inspired by the Python coverage.py package, which provides
a similar utility in Python. The gcovr command produces either compact
human-readable summary reports, machine readable XML reports
(in Cobertura format) or simple HTML reports. Thus, gcovr can be viewed
as a command-line alternative to the lcov utility, which runs gcov and
generates an HTML-formatted report.


`,
      url: "http://gcovr.com/",
      person: [
        { userId: "Pharaoh_Atem", role: LocalRole.Maintainer },
        { userId: "dancermak", role: LocalRole.Maintainer }
      ],
      build: {
        defaultValue: DefaultValue.Unspecified,
        disable: [{ repository: "SLE_12_SP2" }],
        enable: []
      }
    });
  });

  it("gets a package _meta with a develPackage", async () => {
    await fetchPackageMeta(
      con,
      "openSUSE:Factory",
      "vagrant"
    ).should.eventually.deep.equal({
      name: "vagrant",
      project: "openSUSE:Factory",
      description: "",
      title: "",
      develPackage: { project: "Virtualization:vagrant", package: "vagrant" }
    });
  });
});

describe("#setPackageMeta", () => {
  before(skipIfNoMiniObsHook);

  const con = getTestConnection(ApiType.MiniObs);
  const statusOk = {
    code: "ok",
    summary: "Ok"
  };
  const project = `home:${miniObsUsername}`;
  const pkgName = "testPkg";
  const complexPkgName = "complexPkg";

  after(
    miniObsOnlyHook(
      async () =>
        await Promise.all([
          swallowException(deletePackage, con, project, pkgName),
          swallowException(deletePackage, con, project, complexPkgName)
        ])
    )
  );

  it("creates a new package", async function () {
    this.timeout(5000);

    const newPkg: PackageMeta = {
      description: `This is a package that has been created to test obs.ts
It should be gone soon-ish.`,
      name: pkgName,
      project,
      title: "Testpackage, please ignore me"
    };

    await setPackageMeta(
      con,
      project,
      pkgName,
      newPkg
    ).should.eventually.deep.equal(statusOk);

    await fetchPackageMeta(con, project, pkgName).should.eventually.deep.equal(
      newPkg
    );
  });

  it("creates a complicated package", async function () {
    this.timeout(5000);

    const newPkg: PackageMeta = {
      description: `This is a package that has been created to test whether obs.ts can set a lot of values for packages.

It will be deleted when everything works out.
`,
      name: complexPkgName,
      project,
      title: "Testpackage, please ignore me or not, your choice",
      url: "https://build.opensuse.org",
      build: { defaultValue: DefaultValue.Disable, enable: [], disable: [] },
      debugInfo: { defaultValue: DefaultValue.Enable, enable: [], disable: [] }
    };

    await setPackageMeta(
      con,
      project,
      complexPkgName,
      newPkg
    ).should.eventually.deep.equal(statusOk);

    await fetchPackageMeta(
      con,
      project,
      complexPkgName
    ).should.eventually.deep.equal(newPkg);

    await deletePackage(
      con,
      project,
      complexPkgName
    ).should.eventually.deep.equal(statusOk);

    await fetchPackageMeta(con, project, complexPkgName).should.be.rejectedWith(
      ApiError,
      "unknown_package"
    );
  });

  it("throws an error when the project & package names don't match", async () => {
    await setPackageMeta(con, "fooProj", "barPkg", {
      project: "barProj",
      name: "fooPkg",
      description: "",
      title: ""
    }).should.be.rejectedWith(
      /Assertion failed: package name and project name.*do not match/
    );
  });
});
