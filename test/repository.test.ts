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

import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { fetchPackageMeta } from "../src/api/package-meta";
import { fetchProjectMeta } from "../src/api/project-meta";
import {
  fetchProjectsPathsRecursively,
  RepositoryWithFlags,
  repositoryWithFlagsFromMeta
} from "../src/repository";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection
} from "./test-setup";

const con = getTestConnection(ApiType.Production);

describe("RepositoryWithFlags", () => {
  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  const getRepoByNameBuilder = (repos: RepositoryWithFlags[] | undefined) => (
    name: string
  ) => repos!.find((repo) => repo.name === name);

  describe("#repositoryWithFlagsFromMeta", () => {
    it("correctly parses the project flags of home:tkb", async () => {
      const projMeta = await fetchProjectMeta(con, "home:tkb");

      const repos = repositoryWithFlagsFromMeta(projMeta);

      expect(repos).to.be.an("array").and.have.length(40);
      const getRepoByName = getRepoByNameBuilder(repos); // (name: string) =>
      // repos!.find((repo) => repo.name === name);

      const archExtra = getRepoByName("Arch_Extra");
      expect(archExtra!.build).to.equal(true);

      const centOS7 = getRepoByName("CentOS_7");
      expect(centOS7?.build).to.equal(true);

      const fedora29 = getRepoByName("Fedora_29");
      expect(fedora29?.build)
        .to.be.a("map")
        .and.deep.equal(
          new Map([
            ["x86_64", true],
            ["i586", true],
            ["armv7l", false],
            ["aarch64", false],
            ["ppc64le", false]
          ])
        );
      expect(fedora29?.build).to.deep.equal(fedora29?.publish);

      const fedora30 = getRepoByName("Fedora_30");
      expect(fedora30?.build)
        .to.be.a("map")
        .and.deep.equal(
          new Map([
            ["x86_64", true],
            ["i586", false],
            ["armv7l", false],
            ["aarch64", false],
            ["ppc64le", false]
          ])
        );

      const rhel7 = getRepoByName("RHEL_7");
      expect(rhel7?.build).to.deep.equal(
        new Map([
          ["x86_64", true],
          ["ppc64", false]
        ])
      );

      const fedora32 = getRepoByName("Fedora_32");
      expect(fedora32?.publish).to.equal(false);

      const xUbuntu2004 = getRepoByName("xUbuntu_20.04");
      expect(xUbuntu2004?.build).to.equal(true);

      const xUbuntu1910 = getRepoByName("xUbuntu_19.10");
      expect(xUbuntu1910?.build).to.equal(true);

      const xUbuntu1810 = getRepoByName("xUbuntu_18.10");
      expect(xUbuntu1810?.build).to.equal(true);
      expect(xUbuntu1810?.publish).to.equal(true);
    });

    it("correctly parses the package flags of home:tkb/ffmpeg", async () => {
      const projMeta = await fetchProjectMeta(con, "home:tkb");
      const pkgMeta = await fetchPackageMeta(con, "home:tkb", "ffmpeg");

      const repos = repositoryWithFlagsFromMeta(projMeta, pkgMeta);

      expect(repos).to.be.an("array").and.have.length(40);
      const getRepoByName = getRepoByNameBuilder(repos);

      const arch = getRepoByName("Arch");
      expect(arch?.build).to.equal(false);

      const archExtra = getRepoByName("Arch_Extra");
      expect(archExtra?.build).to.equal(false);

      const fedora32 = getRepoByName("Fedora_32");
      expect(fedora32?.build)
        .to.be.a("map")
        .and.deep.equal(
          new Map([
            ["x86_64", true],
            ["armv7l", false],
            ["aarch64", false],
            ["ppc64le", false]
          ])
        );

      const univention44 = getRepoByName("Univention_4.4");
      expect(univention44?.build).to.equal(false);
    });

    it("correctly parses the package flags of home:tkb/qtrans", async () => {
      const projMeta = await fetchProjectMeta(con, "home:tkb");
      const pkgMeta = await fetchPackageMeta(con, "home:tkb", "qtrans");

      const repos = repositoryWithFlagsFromMeta(projMeta, pkgMeta);

      expect(repos).to.be.an("array").and.have.length(40);

      repos!.forEach((repo) => {
        if (repo.name === "Arch") {
          expect(repo?.build).to.equal(true);
        } else if (repo.name === "Arch_Extra") {
          expect(repo?.build).to.deep.equal(
            new Map([
              ["x86_64", true],
              ["i586", false]
            ])
          );
        } else {
          expect(repo?.build).to.equal(false);
        }
      });
      // just check that the two "interesting" repos actually exist
      const getRepoByName = getRepoByNameBuilder(repos);
      expect(getRepoByName("Arch")).to.not.equal(undefined);
      expect(getRepoByName("Arch_Extra")).to.not.equal(undefined);
    });
  });
});

describe("#fetchProjectsPathsRecursively", () => {
  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  it("successfully fetches the paths of Virtualization:vagrant/openSUSE_Tumbleweed", async () => {
    await fetchProjectsPathsRecursively(
      con,
      "Virtualization:vagrant",
      "openSUSE_Tumbleweed"
    ).should.eventually.deep.equal([
      { project: "Virtualization:vagrant", repository: "openSUSE_Tumbleweed" },
      { project: "openSUSE:Factory", repository: "snapshot" },
      { project: "openSUSE:Tumbleweed", repository: "standard" },
      { project: "openSUSE:Tumbleweed", repository: "dod" },
      { project: "openSUSE:Tumbleweed", repository: "dod_debug" },
      { project: "openSUSE:Factory", repository: "ports" }
    ]);
  });

  it("successfully fetches the paths of Virtualization:vagrant/openSUSE_Tumbleweed_and_d_l_r_e", async () => {
    await fetchProjectsPathsRecursively(
      con,
      "Virtualization:vagrant",
      "openSUSE_Tumbleweed_and_d_l_r_e"
    ).should.eventually.deep.equal([
      {
        project: "Virtualization:vagrant",
        repository: "openSUSE_Tumbleweed_and_d_l_r_e"
      },
      {
        project: "devel:languages:ruby:extensions",
        repository: "openSUSE_Tumbleweed"
      },
      { project: "openSUSE:Factory", repository: "snapshot" },
      { project: "openSUSE:Tumbleweed", repository: "standard" },
      { project: "openSUSE:Tumbleweed", repository: "dod" },
      { project: "openSUSE:Tumbleweed", repository: "dod_debug" },
      { project: "openSUSE:Factory", repository: "ports" }
    ]);
  });

  it("successfully expands the SLE repos of Virtualization:vagrant/SLE_15", async () => {
    await fetchProjectsPathsRecursively(
      con,
      "Virtualization:vagrant",
      "SLE_15"
    ).should.eventually.deep.equal([
      { project: "Virtualization:vagrant", repository: "SLE_15" },
      { project: "SUSE:SLE-15:GA", repository: "standard" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Basesystem" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Containers" },
      {
        project: "SUSE:SLE-15:GA",
        repository: "SLE-Module-Desktop-Applications"
      },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Development-Tools" },
      {
        project: "SUSE:SLE-15:GA",
        repository: "SLE-Module-Development-Tools-OBS"
      },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-HPC" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Legacy" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Live-Patching" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Public-Cloud" },
      {
        project: "SUSE:SLE-15:GA",
        repository: "SLE-Module-Server-Applications"
      },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Module-Web-Scripting" },
      { project: "SUSE:SLE-15:GA", repository: "SLES" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Manager-Tools" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Product-HA" },
      { project: "SUSE:SLE-15:GA", repository: "SLE-Product-WE" }
    ]);
  });

  it("correctly expands the repos of Virtualization:Appliances:Images:openSUSE-Tumbleweed/openSUSE_Tumbleweed", async () => {
    await fetchProjectsPathsRecursively(
      con,
      "Virtualization:Appliances:Images:openSUSE-Tumbleweed",
      "openSUSE_Tumbleweed"
    ).should.eventually.deep.equal([
      {
        project: "Virtualization:Appliances:Images:openSUSE-Tumbleweed",
        repository: "openSUSE_Tumbleweed"
      },
      {
        project: "Virtualization:Appliances:Images:openSUSE-Tumbleweed",
        repository: "rpm"
      },
      { project: "openSUSE:Factory", repository: "snapshot" },
      { project: "openSUSE:Tumbleweed", repository: "standard" },
      { project: "openSUSE:Tumbleweed", repository: "dod" },
      { project: "openSUSE:Tumbleweed", repository: "dod_debug" },
      { project: "openSUSE:Factory", repository: "ports" }
    ]);
  });

  it("returns an empty array if the project has no matching repository", async () => {
    await fetchProjectsPathsRecursively(
      con,
      "devel:tools",
      "foo"
    ).should.eventually.deep.equal([]);
  });
});
