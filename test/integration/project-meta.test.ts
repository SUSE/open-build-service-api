/**
 * Copyright (c) 2019-2022 SUSE LLC
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
import {
  Arch,
  BaseRepository,
  BlockMode,
  DownloadOnDemand,
  LinkedBuildMode,
  RebuildMode,
  ReleaseTrigger,
  VrevMode
} from "../../src/api/base-types";
import { DefaultValue } from "../../src/api/flag";
import {
  fetchProjectMeta,
  Kind,
  modifyProjectMeta,
  ProjectMeta
} from "../../src/api/project-meta";
import { ApiError } from "../../src/error";
import { createProject, deleteProject } from "../../src/project";
import { LocalRole } from "../../src/user";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection,
  miniObsAdminCon,
  miniObsOnlyHook,
  miniObsUsername,
  skipIfNoMiniObsHook,
  swallowException
} from "./../test-setup";

const findRepoByNameBuilder = (proj: ProjectMeta) => (repoName: string) =>
  proj.repository?.find((elem) => elem.name === repoName);

const fedora33StandardDoD: DownloadOnDemand[] = [
  {
    arch: Arch.X86_64,
    url: "http://ftp.fau.de/fedora/linux/releases/33/Everything/x86_64/os",
    repositoryType: "rpmmd",
    sslMaster: {
      url:
        "https://dl.fedoraproject.org/pub/fedora/linux/releases/33/Everything/x86_64/os",
      fingerprint:
        "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
    }
  },
  {
    arch: Arch.Armv7l,
    url: "http://ftp.fau.de/fedora/linux/releases/33/Everything/armhfp/os",
    repositoryType: "rpmmd",
    sslMaster: {
      url:
        "https://dl.fedoraproject.org/pub/fedora/linux/releases/33/Everything/armhfp/os",
      fingerprint:
        "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
    }
  },
  {
    arch: Arch.Ppc64le,
    url:
      "http://ftp-stud.hs-esslingen.de/pub/fedora-secondary/releases/33/Everything/ppc64le/os/",
    repositoryType: "rpmmd",
    sslMaster: {
      url:
        "https://dl.fedoraproject.org/pub/fedora-secondary/releases/33/Everything/ppc64le/os/",
      fingerprint:
        "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
    }
  },
  {
    arch: Arch.S390x,
    url:
      "http://ftp-stud.hs-esslingen.de/pub/fedora-secondary/releases/33/Everything/s390x/os/",
    repositoryType: "rpmmd",
    sslMaster: {
      url:
        "https://dl.fedoraproject.org/pub/fedora-secondary/releases/33/Everything/s390x/os/",
      fingerprint:
        "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
    }
  },
  {
    arch: Arch.Aarch64,
    url:
      "https://dl.fedoraproject.org/pub/fedora/linux/releases/33/Everything/aarch64/os/",
    repositoryType: "rpmmd",
    sslMaster: {
      url:
        "https://dl.fedoraproject.org/pub/fedora/linux/releases/33/Everything/aarch64/os/",
      fingerprint:
        "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
    }
  }
];

describe("#fetchProjectMeta", () => {
  const prodCon = getTestConnection(ApiType.Production);

  beforeEach(beforeEachRecordHook);

  afterEach(afterEachRecordHook);

  it("should correctly parse openSUSE:Factory", async () => {
    const proj = await fetchProjectMeta(prodCon.clone(), "openSUSE:Factory");

    expect(proj.name).to.equal("openSUSE:Factory");

    // users
    expect(proj.person).to.deep.include({
      role: "maintainer",
      id: "dimstar_suse"
    });
    expect(proj.person).to.deep.include({
      role: "reviewer",
      id: "factory-auto"
    });

    // groups
    expect(proj.group).to.deep.include({
      id: "factory-maintainers",
      role: "maintainer"
    });
    expect(proj.group).to.deep.include({
      id: "factory-staging",
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

    expect(proj.repository).to.be.a("array").and.have.length(4);

    // check all repositories manually...
    expect(findRepoByName("standard")).to.deep.equal({
      arch: defaultArch,
      name: "standard",
      rebuild: "local"
    });
    expect(findRepoByName("ports")).to.deep.equal({
      arch: ["ppc64le", "ppc64", "ppc", "armv6l", "armv7l", "aarch64"],
      name: "ports"
    });
    expect(findRepoByName("snapshot")).to.deep.equal({
      arch: defaultArch,
      path: [{ project: "openSUSE:Tumbleweed", repository: "standard" }],
      name: "snapshot"
    });
    expect(findRepoByName("images")).to.deep.include({
      arch: ["local", "i586", "x86_64"],
      name: "images",
      path: [{ project: "openSUSE:Factory", repository: "standard" }],
      releaseTarget: [
        {
          project: "openSUSE:Factory:ToTest",
          repository: "images",
          trigger: "manual"
        }
      ]
    });
  });

  it("should correctly parse Virtualization:vagrant", async () => {
    const proj = await fetchProjectMeta(
      prodCon.clone(),
      "Virtualization:vagrant"
    );

    expect(proj.name).to.equal("Virtualization:vagrant");

    // users
    ["dancermak", "ojkastl_buildservice"].forEach((user) => {
      expect(proj.person).to.deep.include({
        role: "maintainer",
        id: user
      });
      expect(proj.person).to.deep.include({
        role: "bugowner",
        id: user
      });
    });

    expect(proj.person).to.deep.include({
      role: "maintainer",
      id: "dirkmueller"
    });

    // no groups defined
    expect(proj.group).to.equal(undefined);

    // title & description
    expect(proj.title).to.equal("Devel project for Vagrant");
    expect(proj.description).to.equal(
      "This is the factory development project for Vagrant"
    );

    // repositories...
    expect(proj.repository).to.be.a("array").and.have.length(10);

    const findRepoByName = findRepoByNameBuilder(proj);
    expect(findRepoByName("openSUSE_Tumbleweed")).to.deep.equal({
      arch: ["i586", "x86_64"],
      name: "openSUSE_Tumbleweed",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_default_ruby")).to.deep.equal({
      arch: ["x86_64"],
      name: "openSUSE_Tumbleweed_default_ruby",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_and_d_l_r_e")).to.deep.equal({
      arch: ["x86_64"],
      name: "openSUSE_Tumbleweed_and_d_l_r_e",
      path: [
        {
          project: "devel:languages:ruby:extensions",
          repository: "openSUSE_Tumbleweed"
        },
        { project: "openSUSE:Factory", repository: "snapshot" }
      ]
    });
    expect(findRepoByName("openSUSE_Leap_15.1_ARM")).to.deep.equal({
      name: "openSUSE_Leap_15.1_ARM",
      arch: ["aarch64", "armv7l"],
      path: [{ project: "openSUSE:Leap:15.1:ARM", repository: "ports" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.1")).to.deep.equal({
      name: "openSUSE_Leap_15.1",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.1", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.2")).to.deep.equal({
      name: "openSUSE_Leap_15.2",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.2", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.0")).to.deep.equal({
      name: "openSUSE_Leap_15.0",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.0", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Factory_ARM")).to.deep.equal({
      name: "openSUSE_Factory_ARM",
      arch: ["armv7l", "aarch64"],
      path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15-SP1")).to.deep.equal({
      name: "SLE_15-SP1",
      arch: ["x86_64", "aarch64"],
      path: [{ project: "SUSE:SLE-15-SP1:GA", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15")).to.deep.equal({
      name: "SLE_15",
      arch: ["x86_64", "aarch64"],
      path: [{ project: "SUSE:SLE-15:GA", repository: "standard" }]
    });
  });

  it("should correctly parse the Virtualization repositories", async () => {
    const proj = await fetchProjectMeta(prodCon.clone(), "Virtualization");
    const findRepoByName = findRepoByNameBuilder(proj);

    expect(proj.name).to.equal("Virtualization");

    // see if we identify the downloader role correctly
    expect(proj.person).to.deep.include({
      role: "downloader",
      id: "christopolise"
    });

    // PowerPC repository includes a block mode setting!
    const ppcRepo = findRepoByName("openSUSE_Factory_PowerPC");
    expect(ppcRepo).to.have.property("block", BlockMode.Local);

    expect(proj)
      .to.have.property("build")
      .that.deep.equals({
        defaultValue: DefaultValue.Unspecified,
        disable: [
          { repository: "Kernel_HEAD_standard" },
          { repository: "Kernel_stable_standard" },
          { arch: "ppc", repository: "openSUSE_Factory_PowerPC" },
          { arch: "x86_64", repository: "openSUSE_Factory_PowerPC" },
          { arch: "x86_64", repository: "openSUSE_Factory_ARM" },
          { arch: "x86_64", repository: "openSUSE_Factory_zSystems" },
          { arch: "riscv64" }
        ],
        enable: []
      });

    expect(proj).to.have.property("debugInfo").that.deep.equals({
      defaultValue: DefaultValue.Enable,
      disable: [],
      enable: []
    });

    expect(proj)
      .to.have.property("publish")
      .that.deep.equals({
        defaultValue: DefaultValue.Unspecified,
        disable: [
          { repository: "Kernel_HEAD_standard" },
          { repository: "Kernel_stable_standard" }
        ],
        enable: []
      });

    // the RISCV repo should have a disabled build for risv64, as that is
    // globally turned off
    const riscvRepo = findRepoByName("openSUSE_Factory_RISV");
    expect(riscvRepo).to.deep.equal({
      name: "openSUSE_Factory_RISV",
      path: [{ project: "openSUSE:Factory:RISCV", repository: "standard" }],
      arch: ["x86_64", "riscv64"]
    });

    // the Kernel_stable_standard repo has globally disabled builds and
    // publishing
    const kernelStableRepo = findRepoByName("Kernel_stable_standard");
    expect(kernelStableRepo).to.deep.equal({
      name: "Kernel_stable_standard",
      path: [{ project: "Kernel:stable", repository: "standard" }],
      arch: ["i586", "x86_64"]
    });
  });

  describe("download on demand repositories", () => {
    it("should correctly parse openSUSE:Tumbleweed", async () => {
      const name = "openSUSE:Tumbleweed";
      const twMeta = await fetchProjectMeta(prodCon, name);
      twMeta.name.should.deep.equal(name);

      expect(twMeta.repository).to.deep.equal([
        {
          name: "standard",
          path: [
            {
              project: "openSUSE:Tumbleweed",
              repository: "dod"
            },
            {
              project: "openSUSE:Tumbleweed",
              repository: "dod_debug"
            },
            { project: "openSUSE:Factory", repository: "ports" }
          ],
          arch: [
            Arch.I586,
            Arch.X86_64,
            Arch.Aarch64,
            Arch.Armv7l,
            Arch.Armv6l,
            Arch.Riscv64
          ]
        },
        {
          name: "dod_debug",
          downloadOnDemand: [
            {
              arch: Arch.I586,
              url: "https://download.opensuse.org/debug/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              architectureFilter: [Arch.I686, Arch.I586],
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.X86_64,
              url: "https://download.opensuse.org/debug/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              architectureFilter: [Arch.X86_64],
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            }
          ],
          arch: [Arch.I586, Arch.X86_64]
        },
        {
          name: "dod",
          downloadOnDemand: [
            {
              arch: Arch.I586,
              url: "https://download.opensuse.org/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              architectureFilter: [Arch.I686, Arch.I586],
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.X86_64,
              url: "https://download.opensuse.org/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              architectureFilter: [Arch.X86_64],
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.Armv6l,
              url:
                "https://download.opensuse.org/ports/armv6hl/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.Armv7l,
              url:
                "https://download.opensuse.org/ports/armv7hl/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.Aarch64,
              url:
                "https://download.opensuse.org/ports/aarch64/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            },
            {
              arch: Arch.Riscv64,
              url:
                "https://download.opensuse.org/ports/riscv/tumbleweed/repo/oss",
              repositoryType: "rpmmd",
              publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
            }
          ],
          arch: [
            Arch.I586,
            Arch.X86_64,
            Arch.Aarch64,
            Arch.Armv7l,
            Arch.Armv6l,
            Arch.Riscv64
          ]
        }
      ]);
    });

    it("should correctly parse Fedora:33's ssl verfication elements", async () => {
      const meta = await fetchProjectMeta(prodCon, "Fedora:33");
      const fedora33UpdateDoD: DownloadOnDemand[] = [
        {
          arch: Arch.X86_64,
          url:
            "http://ftp-stud.hs-esslingen.de/pub/fedora/linux/updates/33/Everything/x86_64/",
          repositoryType: "rpmmd",
          sslMaster: {
            url:
              "https://dl.fedoraproject.org/pub/fedora/linux/updates/33/Everything/x86_64/",
            fingerprint:
              "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
          }
        },
        {
          arch: Arch.I586,
          url:
            "https://kojipkgs.fedoraproject.org/repos/f33-build/latest/i386/",
          repositoryType: "rpmmd",
          sslMaster: {
            url:
              "https://kojipkgs.fedoraproject.org/repos/f33-build/latest/i386/",
            fingerprint:
              "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
          }
        },
        {
          arch: Arch.Armv7l,
          url:
            "http://ftp-stud.hs-esslingen.de/pub/fedora/linux/updates/33/Everything/armhfp/",
          repositoryType: "rpmmd",
          sslMaster: {
            url:
              "https://dl.fedoraproject.org/pub/fedora/linux/updates/33/Everything/armhfp/",
            fingerprint:
              "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
          }
        },
        {
          arch: Arch.Ppc64le,
          url:
            "http://ftp-stud.hs-esslingen.de/pub/fedora-secondary/updates/33/Everything/ppc64le/",
          repositoryType: "rpmmd",
          sslMaster: {
            url:
              "https://dl.fedoraproject.org/pub/fedora/updates/33/Everything/ppc64le/",
            fingerprint:
              "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
          }
        },
        {
          arch: Arch.Aarch64,
          url: "http://ftp.fau.de/fedora/linux/updates/33/Everything/aarch64/",
          repositoryType: "rpmmd",
          sslMaster: {
            url:
              "https://dl.fedoraproject.org/pub/fedora/linux/updates/33/Everything/aarch64/",
            fingerprint:
              "sha256:65a9f760749609c590387157e58a308b0d55d7f343da82bbe5ea945d2f0e338a"
          }
        }
      ];

      expect(meta.repository).to.deep.equal([
        {
          name: "update",
          downloadOnDemand: fedora33UpdateDoD,
          path: [{ project: "Fedora:33", repository: "standard" }],
          arch: [
            Arch.X86_64,
            Arch.I586,
            Arch.Armv7l,
            Arch.Aarch64,
            Arch.Ppc64le
          ]
        },
        {
          name: "standard",
          downloadOnDemand: fedora33StandardDoD,
          arch: [
            Arch.X86_64,
            Arch.I586,
            Arch.Armv7l,
            Arch.Aarch64,
            Arch.S390x,
            Arch.Ppc64le
          ]
        }
      ]);
    });
  });
});

describe("#modifyOrCreateProject", function () {
  const con = getTestConnection(ApiType.MiniObs);

  before(skipIfNoMiniObsHook);
  after(
    miniObsOnlyHook(() =>
      Promise.all(
        projNames.map((name) => swallowException(deleteProject, con, name))
      )
    )
  );

  const dodProjectName = `home:${miniObsUsername}:test_dod_project`;
  const projNames = [
    `home:${miniObsUsername}:obs_ts_test`,
    `home:${miniObsUsername}:set_as_many_properties_as_we_can`,
    dodProjectName
  ];

  this.timeout(10000);

  it("creates a new project", async function () {
    const name = projNames[0];
    const newProj: ProjectMeta = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.`,
      name,
      title: "Testproject created by obs.ts"
    };
    const statusOk = {
      code: "ok",
      summary: "Ok"
    };

    await modifyProjectMeta(con, newProj).should.eventually.deep.equal(
      statusOk
    );

    // OBS automatically adds the owner of the home project as the maintainer
    newProj.person = [{ id: miniObsUsername, role: LocalRole.Maintainer }];

    await fetchProjectMeta(con, name).should.eventually.deep.equal(newProj);

    await deleteProject(con, name).should.eventually.deep.equal(statusOk);

    await fetchProjectMeta(con, name).should.be.rejectedWith(
      ApiError,
      "unknown_project"
    );
  });

  it("creates a new complicated project", async function () {
    this.timeout(10000);
    const name = projNames[1];

    const newProj: ProjectMeta = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.

Here we just try to set as many different options as possible, to check that the XML payload is correct`,
      name,
      title: "Testproject created by obs.ts ;-)",
      person: [
        { id: miniObsUsername, role: LocalRole.Bugowner },
        { id: "Admin", role: LocalRole.Reader }
      ],
      link: [{ vrevmode: VrevMode.Unextend, project: "openSUSE:Factory" }],
      group: [
        { id: "admins", role: LocalRole.Downloader },
        { id: "everyone", role: LocalRole.Reviewer }
      ],
      access: true,
      sourceAccess: false,
      lock: false,
      kind: Kind.Maintenance,
      url: "https://github.com/SUSE/open-build-service-api",
      build: { defaultValue: DefaultValue.Enable, enable: [], disable: [] },
      useForBuild: {
        defaultValue: DefaultValue.Disable,
        enable: [],
        disable: []
      },
      debugInfo: {
        defaultValue: DefaultValue.Unspecified,
        enable: [
          { arch: Arch.X86_64, repository: "test" },
          { arch: Arch.Riscv64, repository: "test" }
        ],
        disable: [{ arch: Arch.Aarch64, repository: "test" }]
      },
      publish: {
        defaultValue: DefaultValue.Unspecified,
        enable: [{ repository: "test" }],
        disable: []
      },
      repository: [
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
          linkedBuild: LinkedBuildMode.LocalDep,
          releaseTarget: [
            {
              project: "openSUSE:Factory",
              repository: "standard",
              trigger: ReleaseTrigger.Manual
            }
          ],
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

    await modifyProjectMeta(con, newProj).should.eventually.deep.equal(
      statusOk
    );

    // OBS adds the home project owner automatically as a maintainer
    // ...unfortunately at another position
    newProj.person!.splice(1, 0, {
      id: miniObsUsername,
      role: LocalRole.Maintainer
    });

    await fetchProjectMeta(con, name).should.eventually.deep.equal(newProj);

    await deleteProject(con, name).should.eventually.deep.equal(statusOk);

    await fetchProjectMeta(con, name).should.be.rejectedWith(
      ApiError,
      "unknown_project"
    );
  });

  it("creates dod repositories as an admin", async () => {
    const proj = await createProject(con, dodProjectName);
    const dodRepos: BaseRepository[] = [
      {
        name: "dod",
        downloadOnDemand: [
          {
            arch: Arch.X86_64,
            url: "https://download.opensuse.org/tumbleweed/repo/oss",
            repositoryType: "rpmmd",
            architectureFilter: [Arch.X86_64],
            publicKey: `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.15 (GNU/Linux)

mQENBEkUTD8BCADWLy5d5IpJedHQQSXkC1VK/oAZlJEeBVpSZjMCn8LiHaI9Wq3G
3Vp6wvsP1b3kssJGzVFNctdXt5tjvOLxvrEfRJuGfqHTKILByqLzkeyWawbFNfSQ
93/8OunfSTXC1Sx3hgsNXQuOrNVKrDAQUqT620/jj94xNIg09bLSxsjN6EeTvyiO
mtE9H1J03o9tY6meNL/gcQhxBvwuo205np0JojYBP0pOfN8l9hnIOLkA0yu4ZXig
oKOVmf4iTjX4NImIWldT+UaWTO18NWcCrujtgHueytwYLBNV5N0oJIP2VYuLZfSD
VYuPllv7c6O2UEOXJsdbQaVuzU1HLocDyipnABEBAAG0NG9wZW5TVVNFIFByb2pl
Y3QgU2lnbmluZyBLZXkgPG9wZW5zdXNlQG9wZW5zdXNlLm9yZz6JATwEEwECACYC
GwMGCwkIBwMCBBUCCAMEFgIDAQIeAQIXgAUCU2dN1AUJHR8ElQAKCRC4iy/UPb3C
hGQrB/9teCZ3Nt8vHE0SC5NmYMAE1Spcjkzx6M4r4C70AVTMEQh/8BvgmwkKP/qI
CWo2vC1hMXRgLg/TnTtFDq7kW+mHsCXmf5OLh2qOWCKi55Vitlf6bmH7n+h34Sha
Ei8gAObSpZSF8BzPGl6v0QmEaGKM3O1oUbbB3Z8i6w21CTg7dbU5vGR8Yhi9rNtr
hqrPS+q2yftjNbsODagaOUb85ESfQGx/LqoMePD+7MqGpAXjKMZqsEDP0TbxTwSk
4UKnF4zFCYHPLK3y/hSH5SEJwwPY11l6JGdC1Ue8Zzaj7f//axUs/hTC0UZaEE+a
5v4gbqOcigKaFs9Lc3Bj8b/lE10Y
=i2TA
-----END PGP PUBLIC KEY BLOCK-----
            `
          }
        ],
        arch: [
          Arch.I586,
          Arch.X86_64,
          Arch.Aarch64,
          Arch.Armv7l,
          Arch.Armv6l,
          Arch.Riscv64
        ]
      },
      {
        name: "standard",
        downloadOnDemand: fedora33StandardDoD,
        arch: [
          Arch.X86_64,
          Arch.I586,
          Arch.Armv7l,
          Arch.Aarch64,
          Arch.S390x,
          Arch.Ppc64le
        ]
      }
    ];

    const newMeta = { ...proj.meta, repository: dodRepos };
    await modifyProjectMeta(miniObsAdminCon, newMeta);

    const { repository, ...restOfMeta } = await fetchProjectMeta(
      con,
      proj.name
    );
    restOfMeta.should.deep.equal(proj.meta);

    // obs reorders the repositories...
    expect(repository).to.have.length(dodRepos.length);
    dodRepos.forEach((dodRepo) =>
      expect(repository).to.include.a.thing.that.deep.equals(dodRepo)
    );
  });
});
