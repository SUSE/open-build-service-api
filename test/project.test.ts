import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import * as nock from "nock";
import { join } from "path";

nock.back.fixtures = join(__dirname, "..", "fixtures");

import * as OBS from "../src/obs";
import { Connection } from "../src/connection";

const conn = new Connection("fakeUsername", "fakePassword");

const findRepoByNameBuilder = (proj: OBS.Project.Project) => (
  repoName: string
) => proj.repositories.find(elem => elem.name === repoName);

describe("Project", () => {
  beforeEach(async function() {
    const json_path =
      this.currentTest!.titlePath()
        .map(elem => elem.replace(/\s+/g, "_"))
        .join("_") + ".json";

    nock.back.setMode("record");
    const { nockDone } = await nock.back(json_path);
    this.nockDone = nockDone;
  });

  afterEach(function() {
    this.nockDone();
    nock.back.setMode("wild");
  });

  it("should correctly parse openSUSE:Factory", async function() {
    const proj = await OBS.Project.getProject(conn, "openSUSE:Factory");

    expect(proj.name).to.equal("openSUSE:Factory");

    // users
    expect(proj.person).to.deep.include({
      user_id: "dimstar_suse",
      role: "maintainer"
    });
    expect(proj.person).to.deep.include({
      user_id: "factory-auto",
      role: "reviewer"
    });

    // groups
    expect(proj.group).to.deep.include({
      group_id: "factory-maintainers",
      role: "maintainer"
    });
    expect(proj.group).to.deep.include({
      group_id: "factory-staging",
      role: "reviewer"
    });

    // lock defaults to false
    expect(proj.lock).to.equal(false);

    // these two are not set and should be undefined
    expect(proj.access).to.equal(undefined);
    expect(proj.sourceAccess).to.equal(undefined);

    // repositories
    const defaultArch = ["x86_64", "i586"];

    const findRepoByName = findRepoByNameBuilder(proj);

    // check all repositories manually...
    expect(findRepoByName("standard")).to.deep.include({
      name: "standard",
      rebuild: "local",
      arch: defaultArch,
      publish: true,
      debugInfo: true,
      build: undefined
    });
    expect(findRepoByName("ports")).to.deep.include({
      name: "ports",
      debugInfo: true,
      publish: false,
      build: false,
      arch: ["ppc64le", "ppc64", "ppc", "armv6l", "armv7l", "aarch64"]
    });
    expect(findRepoByName("totest")).to.deep.include({
      name: "totest",
      arch: defaultArch,
      build: false,
      publish: false,
      debugInfo: true
    });
    expect(findRepoByName("snapshot")).to.deep.include({
      name: "snapshot",
      arch: defaultArch,
      build: false,
      publish: false,
      debugInfo: true
    });
    expect(findRepoByName("images")).to.deep.include({
      name: "images",
      arch: ["local", "i586", "x86_64"],
      path: [{ project: "openSUSE:Factory", repository: "standard" }],
      build: undefined,
      debugInfo: true,
      publish: false,
      releasetarget: [
        {
          project: "openSUSE:Factory:ToTest",
          repository: "images",
          trigger: "manual"
        }
      ]
    });
  });

  it("should correctly parse Virtualization:vagrant", async function() {
    const proj = await OBS.Project.getProject(conn, "Virtualization:vagrant");

    expect(proj.name).to.equal("Virtualization:vagrant");

    // users
    ["dancermak", "robert_munteanu", "ojkastl_buildservice"].forEach(user => {
      expect(proj.person).to.deep.include({
        user_id: user,
        role: "maintainer"
      });
      expect(proj.person).to.deep.include({
        user_id: user,
        role: "bugowner"
      });
    });

    expect(proj.person).to.deep.include({
      user_id: "dirkmueller",
      role: "maintainer"
    });

    // no groups defined
    expect(proj.group)
      .to.be.a("array")
      .and.to.have.length(0);

    // title & description
    expect(proj.title).to.equal("Devel project for Vagrant");
    expect(proj.description).to.equal(
      "This is the factory development project for Vagrant"
    );

    // repositories...
    expect(proj.repositories)
      .to.be.a("array")
      .and.have.length(9);

    const findRepoByName = findRepoByNameBuilder(proj);
    expect(findRepoByName("openSUSE_Tumbleweed")).to.deep.include({
      name: "openSUSE_Tumbleweed",
      arch: ["i586", "x86_64"],
      publish: true,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_default_ruby")).to.deep.include({
      name: "openSUSE_Tumbleweed_default_ruby",
      arch: ["x86_64"],
      publish: false,
      build: false,
      debugInfo: true,
      useForBuild: false,
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_and_d_l_r_e")).to.deep.include({
      name: "openSUSE_Tumbleweed_and_d_l_r_e",
      arch: ["x86_64"],
      publish: false,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [
        {
          project: "devel:languages:ruby:extensions",
          repository: "openSUSE_Tumbleweed"
        },
        { project: "openSUSE:Factory", repository: "snapshot" }
      ]
    });
    expect(findRepoByName("openSUSE_Leap_15.1_ARM")).to.deep.include({
      name: "openSUSE_Leap_15.1_ARM",
      arch: ["aarch64", "armv7l"],
      publish: true,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "openSUSE:Leap:15.1:ARM", repository: "ports" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.1")).to.deep.include({
      name: "openSUSE_Leap_15.1",
      arch: ["x86_64"],
      publish: true,
      build: false,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "openSUSE:Leap:15.1", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.0")).to.deep.include({
      name: "openSUSE_Leap_15.0",
      arch: ["x86_64"],
      publish: true,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "openSUSE:Leap:15.0", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Factory_ARM")).to.deep.include({
      name: "openSUSE_Factory_ARM",
      arch: ["armv7l", "aarch64"],
      publish: true,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15-SP1")).to.deep.include({
      name: "SLE_15-SP1",
      arch: ["x86_64", "aarch64"],
      publish: true,
      build: false,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "SUSE:SLE-15-SP1:GA", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15")).to.deep.include({
      name: "SLE_15",
      arch: ["x86_64", "aarch64"],
      publish: true,
      build: true,
      debugInfo: true,
      useForBuild: undefined,
      path: [{ project: "SUSE:SLE-15:GA", repository: "standard" }]
    });
  });
});
