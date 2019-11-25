import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { DefaultValue } from "../../src/api/flag";
import {
  getPackageMeta,
  PackageMeta,
  setProjectMeta
} from "../../src/api/package-meta";
import { StatusReply } from "../../src/error";
import { deletePackage } from "../../src/package";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  checkApiCallSucceeds,
  getTestConnection
} from "./../test-setup";

describe("#getPackageMeta", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("gets a package _meta", async () => {
    const [project, name] = ["devel:tools", "gcovr"];
    const gcovr = await getPackageMeta(con, project, name).should.be.fulfilled;

    expect(gcovr).to.deep.equal({
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
    const vagrant = await getPackageMeta(con, "openSUSE:Factory", "vagrant")
      .should.be.fulfilled;

    expect(vagrant).to.deep.equal({
      name: "vagrant",
      project: "openSUSE:Factory",
      description: "",
      title: "",
      develPackage: { project: "Virtualization:vagrant", package: "vagrant" }
    });
  });
});

describe("#setPackageMeta", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Staging);
  const statusOk = {
    code: "ok",
    summary: "Ok"
  };

  it("creates a new package", async function() {
    this.timeout(5000);
    const project = "home:dancermak";
    const name = "testPkg";
    const newPkg: PackageMeta = {
      description: `This is a package that has been created to test obs.ts
It should be gone soon-ish.`,
      name,
      project,
      title: "Testpackage, please ignore me"
    };

    let res: StatusReply = await checkApiCallSucceeds(
      this.scopes?.[0],
      async () => setProjectMeta(con, project, name, newPkg)
    );
    res.should.deep.equal(statusOk);

    const pkgReply = await checkApiCallSucceeds(this.scopes?.[1], async () =>
      getPackageMeta(con, project, name)
    );
    pkgReply.should.deep.equal(newPkg);

    res = await checkApiCallSucceeds(this.scopes?.[2], async () =>
      deletePackage(con, { name, project })
    );
    res.should.deep.equal(statusOk);
  });

  it("creates a complicated package", async function() {
    this.timeout(5000);
    const project = "home:dancermak";
    const name = "complexPkg";
    const newPkg: PackageMeta = {
      description: `This is a package that has been created to test whether obs.ts can set a lot of values for packages.

It will be deleted when everything works out.
`,
      name,
      project,
      title: "Testpackage, please ignore me or not, your choice",
      url: "https://build.opensuse.org",
      develPackage: { package: "gcc", project: "openSUSE:Factory" },
      build: { defaultValue: DefaultValue.Disable, enable: [], disable: [] },
      debugInfo: { defaultValue: DefaultValue.Enable, enable: [], disable: [] }
    };

    let res: StatusReply = await checkApiCallSucceeds(
      this.scopes?.[0],
      async () => setProjectMeta(con, project, name, newPkg)
    );
    res.should.deep.equal(statusOk);

    const pkgReply = await checkApiCallSucceeds(this.scopes?.[1], async () =>
      getPackageMeta(con, project, name)
    );
    pkgReply.should.deep.equal(newPkg);

    res = await checkApiCallSucceeds(this.scopes?.[2], async () =>
      deletePackage(con, { name, project })
    );
    res.should.deep.equal(statusOk);
  });

  it("throws an error when the project & package names don't match", async () => {
    await setProjectMeta(con, "fooProj", "barPkg", {
      project: "barProj",
      name: "fooPkg",
      description: "",
      title: ""
    }).should.be.rejectedWith(
      /Assertion failed: package name and project name.*do not match/
    );
  });
});
