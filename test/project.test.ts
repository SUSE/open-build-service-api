import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";

import {
  afterEachRecord,
  afterEachRecorded,
  ApiType,
  beforeEachRecord,
  beforeEachRecorded,
  checkApiCallFails,
  checkApiCallSucceeds,
  getTestConnection
} from "./test-setup";

import { StatusReply } from "../src/error";
import {
  Arch,
  BlockMode,
  deleteProject,
  getProject,
  Kind,
  LinkedBuildMode,
  modifyOrCreateProject,
  Project,
  RebuildMode,
  ReleaseTrigger,
  VrevMode
} from "../src/project";
import { LocalRole } from "../src/user";

const findRepoByNameBuilder = (proj: Project) => (repoName: string) =>
  proj.repositories?.find(elem => elem.name === repoName);

describe("#getProject", () => {
  const prodCon = getTestConnection(ApiType.Production);

  beforeEach(beforeEachRecorded);

  afterEach(afterEachRecorded);

  it("should correctly parse openSUSE:Factory", async () => {
    const proj = await getProject(prodCon, "openSUSE:Factory").should.be
      .fulfilled;

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
    const proj = await getProject(prodCon, "Virtualization:vagrant").should.be
      .fulfilled;

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
    expect(proj.group).to.be.undefined;

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
      arch: ["i586", "x86_64"],
      build: true,
      debugInfo: true,
      name: "openSUSE_Tumbleweed",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }],
      publish: true
    });
    expect(findRepoByName("openSUSE_Tumbleweed_default_ruby")).to.deep.include({
      arch: ["x86_64"],
      build: false,
      debugInfo: true,
      name: "openSUSE_Tumbleweed_default_ruby",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }],
      publish: false,
      useForBuild: false
    });
    expect(findRepoByName("openSUSE_Tumbleweed_and_d_l_r_e")).to.deep.include({
      name: "openSUSE_Tumbleweed_and_d_l_r_e",
      arch: ["x86_64"],
      publish: false,
      build: true,
      debugInfo: true,
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
      path: [{ project: "openSUSE:Leap:15.1:ARM", repository: "ports" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.1")).to.deep.include({
      name: "openSUSE_Leap_15.1",
      arch: ["x86_64"],
      publish: true,
      build: false,
      debugInfo: true,
      path: [{ project: "openSUSE:Leap:15.1", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.0")).to.deep.include({
      name: "openSUSE_Leap_15.0",
      arch: ["x86_64"],
      publish: true,
      build: true,
      debugInfo: true,
      path: [{ project: "openSUSE:Leap:15.0", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Factory_ARM")).to.deep.include({
      name: "openSUSE_Factory_ARM",
      arch: ["armv7l", "aarch64"],
      publish: true,
      build: true,
      debugInfo: true,
      path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15-SP1")).to.deep.include({
      name: "SLE_15-SP1",
      arch: ["x86_64", "aarch64"],
      publish: true,
      build: false,
      debugInfo: true,
      path: [{ project: "SUSE:SLE-15-SP1:GA", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15")).to.deep.include({
      name: "SLE_15",
      arch: ["x86_64", "aarch64"],
      publish: true,
      build: true,
      debugInfo: true,
      path: [{ project: "SUSE:SLE-15:GA", repository: "standard" }]
    });
  });

  it("should correctly parse the Virtualization repositories", async () => {
    const proj = await getProject(prodCon, "Virtualization").should.be
      .fulfilled;
    const findRepoByName = findRepoByNameBuilder(proj);

    expect(proj.name).to.equal("Virtualization");

    // see if we identify the downloader role correctly
    expect(proj.person).to.deep.include({
      role: "downloader",
      userId: "christopolise"
    });

    // PowerPC repository has custom settings for the build flag and includes a
    // block mode setting!
    const ppcRepo = findRepoByName("openSUSE_Factory_PowerPC");
    expect(ppcRepo)
      .to.have.property("build")
      .that.is.a("Map");

    const ppcBuild = ppcRepo!.build as Map<Arch, boolean | undefined>;

    expect(ppcBuild).to.have.keys("x86_64", "ppc64", "ppc64le", "ppc");

    expect(ppcBuild.get(Arch.X86_64)).to.be.false;
    expect(ppcBuild.get(Arch.Ppc)).to.be.false;
    expect(ppcBuild.get(Arch.Ppc64le)).to.be.undefined;
    expect(ppcBuild.get(Arch.Ppc64)).to.be.undefined;

    expect(ppcRepo).to.have.property("block", BlockMode.Local);
    expect(ppcRepo).to.have.property("debugInfo", true);

    // the RISCV repo should have a disabled build for risv64, as that is
    // globally turned off
    const riscvRepo = findRepoByName("openSUSE_Factory_RISV");
    expect(riscvRepo)
      .to.have.property("build")
      .that.is.a("Map");
    const riscvBuild = riscvRepo!.build as Map<Arch, boolean | undefined>;
    expect(riscvBuild.get(Arch.Riscv64)).to.be.false;

    // the Kernel_stable_standard repo has globally disabled builds and
    // publishing
    const kernelStableRepo = findRepoByName("Kernel_stable_standard");
    expect(kernelStableRepo).to.deep.include({
      build: false,
      debugInfo: true,
      publish: false
    });
  });
});

describe("#modifyOrCreateProject", () => {
  const stagingCon = getTestConnection(ApiType.Staging);

  beforeEach(beforeEachRecord);

  afterEach(afterEachRecord);

  it("creates a new project", async function() {
    this.timeout(5000);
    const name = "home:dancermak:obs_ts_test";
    const newProj: Project = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.`,
      name,
      title: "Testproject created by obs.ts"
    };
    const statusOk = {
      code: "ok",
      summary: "Ok"
    };

    let res: StatusReply | Project = await checkApiCallSucceeds(
      this.scopes?.[0],
      async () => modifyOrCreateProject(stagingCon, newProj)
    );
    res.should.deep.equal(statusOk);

    // OBS automatically adds the owner of the home project as the maintainer
    newProj.person = [{ userId: "dancermak", role: LocalRole.Maintainer }];

    res = await checkApiCallSucceeds(this.scopes?.[1], async () =>
      getProject(stagingCon, name)
    );
    res.should.deep.equal(newProj);

    res = await checkApiCallSucceeds(this.scopes?.[2], async () =>
      deleteProject(stagingCon, newProj)
    );
    res.should.deep.equal(statusOk);

    const err = await checkApiCallFails(this.scopes?.[3], async () =>
      getProject(stagingCon, name)
    ).should.be.fulfilled;

    expect(err.status).to.deep.equal({
      code: "unknown_project",
      summary: name
    });
  });

  it("creates a new complicated project", async function() {
    this.timeout(10000);
    const name = "home:dancermak:set_as_many_properties_as_we_can";
    const newProj: Project = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.

Here we just try to set as many different options as possible, to check that the XML payload is correct`,
      name,
      title: "Testproject created by obs.ts ;-)",
      person: [
        { userId: "dancermak", role: LocalRole.Bugowner },
        { userId: "hennevogel", role: LocalRole.Reader }
      ],
      link: [{ vrevmode: VrevMode.Unextend, project: "openSUSE:Factory" }],
      group: [
        { groupId: "factory-staging", role: LocalRole.Downloader },
        { groupId: "suse-fuzzies", role: LocalRole.Reviewer }
      ],
      access: true,
      sourceAccess: false,
      lock: false,
      kind: Kind.Maintenance,
      url: "https://gitlab.suse.de/dancermak/obs.ts",
      repositories: [
        {
          name: "test",
          arch: [
            Arch.X86_64,
            Arch.Aarch64,
            Arch.Ppc64,
            Arch.S390x,
            Arch.Riscv64
          ],
          rebuild: RebuildMode.Direct,
          block: BlockMode.Local,
          linkedbuild: LinkedBuildMode.LocalDep,
          releasetarget: [
            {
              project: "openSUSE:Factory",
              repository: "standard",
              trigger: ReleaseTrigger.Manual
            }
          ],
          build: true,
          useForBuild: false,
          debugInfo: new Map<Arch, boolean | undefined>([
            [Arch.X86_64, true],
            [Arch.Aarch64, false],
            [Arch.Riscv64, true]
          ]),
          publish: true,
          path: [
            { project: "openSUSE:Factory", repository: "standard" },
            { project: "openSUSE:Factory", repository: "ports" }
          ]
        },
        { name: "anotherTest" }
      ]
    };
    const statusOk = {
      code: "ok",
      summary: "Ok"
    };

    let res: StatusReply | Project = await checkApiCallSucceeds(
      this.scopes?.[0],
      async () => modifyOrCreateProject(stagingCon, newProj)
    ).should.be.fulfilled;
    res.should.deep.equal(statusOk);

    // OBS adds the home project owner automatically as a maintainer
    // ...unfortunately at another position
    newProj.person?.splice(1, 0, {
      userId: "dancermak",
      role: LocalRole.Maintainer
    });

    // FIXME: the debugInfo setting which we get back will have the arches that
    // we did not set explicitly set to undefined.
    newProj.repositories![0]!.arch!.forEach(arch => {
      if (
        !(newProj.repositories![0]!.debugInfo as Map<
          Arch,
          boolean | undefined
        >).has(arch)
      ) {
        (newProj.repositories![0]!.debugInfo as Map<
          Arch,
          boolean | undefined
        >).set(arch, undefined);
      }
    });

    res = await checkApiCallSucceeds(this.scopes?.[1], async () =>
      getProject(stagingCon, name)
    ).should.be.fulfilled;
    res.should.deep.equal(newProj);

    res = await checkApiCallSucceeds(this.scopes?.[2], async () =>
      deleteProject(stagingCon, newProj)
    ).should.be.fulfilled;
    res.should.deep.equal(statusOk);

    const err = await checkApiCallFails(this.scopes?.[3], async () =>
      getProject(stagingCon, name)
    ).should.be.fulfilled;

    expect(err.status).to.deep.equal({
      code: "unknown_project",
      summary: name
    });
  });
});
