import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";

import { afterEachRecorded, beforeEachRecorded } from "./nock-record";
import { getTestConnection } from "./test-con";

import * as OBS from "../src/obs";

const conn = getTestConnection();

const findRepoByNameBuilder = (proj: OBS.Project.Project) => (
  repoName: string
) => proj.repositories.find(elem => elem.name === repoName);

describe("Project", () => {
  beforeEach(beforeEachRecorded);

  afterEach(afterEachRecorded);

  it("should correctly parse openSUSE:Factory", async () => {
    const proj = await OBS.Project.getProject(conn, "openSUSE:Factory");

    expect(proj.name).to.equal("openSUSE:Factory");

    // users
    expect(proj.person).to.deep.include({
      role: "maintainer",
      userId: "dimstar_suse"
    });
    expect(proj.person).to.deep.include({
      role: "reviewer",
      userId: "factory-auto"
    });

    // groups
    expect(proj.group).to.deep.include({
      groupId: "factory-maintainers",
      role: "maintainer"
    });
    expect(proj.group).to.deep.include({
      groupId: "factory-staging",
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

    expect(proj.repositories)
      .to.be.a("array")
      .and.have.length(4);

    // check all repositories manually...
    expect(findRepoByName("standard")).to.deep.include({
      arch: defaultArch,
      build: undefined,
      debugInfo: true,
      name: "standard",
      publish: true,
      rebuild: "local"
    });
    expect(findRepoByName("ports")).to.deep.include({
      arch: ["ppc64le", "ppc64", "ppc", "armv6l", "armv7l", "aarch64"],
      build: false,
      debugInfo: true,
      name: "ports",
      publish: false
    });
    expect(findRepoByName("snapshot")).to.deep.include({
      arch: defaultArch,
      build: false,
      debugInfo: true,
      name: "snapshot",
      publish: false
    });
    expect(findRepoByName("images")).to.deep.include({
      arch: ["local", "i586", "x86_64"],
      build: undefined,
      debugInfo: true,
      name: "images",
      path: [{ project: "openSUSE:Factory", repository: "standard" }],
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

  it("should correctly parse Virtualization:vagrant", async () => {
    const proj = await OBS.Project.getProject(conn, "Virtualization:vagrant");

    expect(proj.name).to.equal("Virtualization:vagrant");

    // users
    ["dancermak", "ojkastl_buildservice"].forEach(user => {
      expect(proj.person).to.deep.include({
        role: "maintainer",
        userId: user
      });
      expect(proj.person).to.deep.include({
        role: "bugowner",
        userId: user
      });
    });

    expect(proj.person).to.deep.include({
      role: "maintainer",
      userId: "dirkmueller"
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
