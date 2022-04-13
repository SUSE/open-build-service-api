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

import mockFs = require("mock-fs");

import { Arch } from "../src/api/base-types";
import { DefaultValue } from "../src/api/flag";
import { Project } from "../src/project";
import { LocalRole } from "../src/user";
import { FrozenPackageFile, PackageFile } from "./../src/file";
import { Revision } from "./../src/history";

const commonEntries = {
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs"
};

export const vagrantSshfsHistory: ReadonlyArray<Revision> = Object.freeze(
  [
    {
      revision: 1,
      versionRevision: 1,
      revisionHash: "c4458905a38f029e0572e848e8083eb5",
      version: "1.3.1",
      commitTime: new Date("Sun, 22 Sep 2019 13:22:55 +0200"),
      userId: "ojkastl_buildservice",
      commitMessage: "Create a RPM package of the vagrant-sshfs plugin",
      requestId: 731596
    },
    {
      revision: 2,
      versionRevision: 2,
      revisionHash: "37609c2ee2308324c2112d0b0ec406b5",
      commitTime: new Date("Wed, 25 Sep 2019 08:22:59 +0200"),
      userId: "dimstar_suse",
      commitMessage: "initialized devel package after accepting 732747",
      requestId: 732747
    },
    {
      revision: 3,
      versionRevision: 3,
      revisionHash: "49e027533df2ff4849938bf30e7514a9",
      commitTime: new Date("Tue, 01 Oct 2019 15:23:11 +0200"),
      userId: "dancermak",
      commitMessage:
        "Fix for testsuite.sh's cleanup function: don't fail when vagrant destroy fails",
      requestId: 733761
    },
    {
      revision: 4,
      versionRevision: 4,
      revisionHash: "ddb63f844f1ccd05f4b9f0a935fdcbdf",
      commitTime: new Date("Wed, 02 Oct 2019 12:00:08 +0200"),
      userId: "buildservice-autocommit",
      commitMessage: "baserev update by copy to link target",
      requestId: 734337
    },
    {
      revision: 5,
      versionRevision: 5,
      revisionHash: "cf7d64af5cadf92bb2dc23f7c24b5017",
      commitTime: new Date("Fri, 11 Oct 2019 12:22:03 +0200"),
      userId: "dancermak",
      commitMessage: "Fix vagrant box name in testsuite.sh",
      requestId: 736437
    },
    {
      revision: 6,
      versionRevision: 6,
      revisionHash: "28d92afc8c7bd32db4f253c5648f2ac4",
      commitTime: new Date("Fri, 11 Oct 2019 15:22:37 +0200"),
      userId: "buildservice-autocommit",
      commitMessage: "baserev update by copy to link target",
      requestId: 737442
    },
    {
      revision: 7,
      versionRevision: 7,
      revisionHash: "72e98a790ed85a09fad7cc2f4d535542",
      commitTime: new Date("Thu, 07 Nov 2019 22:12:32 +0100"),
      userId: "dancermak",
      commitMessage: "Add missing sshfs dependency",
      requestId: 746422
    },
    {
      revision: 8,
      versionRevision: 8,
      revisionHash: "5674645a0f6536aa31be9af2dbca8586",
      commitTime: new Date("Fri, 08 Nov 2019 15:26:53 +0100"),
      userId: "buildservice-autocommit",
      commitMessage: "baserev update by copy to link target",
      requestId: 746427
    },
    {
      revision: 9,
      versionRevision: 9,
      revisionHash: "e4aaad64028c063c1621e44d14c083a3",
      commitTime: new Date("Fri, 31 Jan 2020 12:52:18 +0100"),
      userId: "dancermak",
      commitMessage: "New upstream release 1.3.3",
      requestId: 768265
    },
    {
      revision: 10,
      versionRevision: 12,
      revisionHash: "a00f147501c86573d7a79578786867ad",
      commitTime: new Date("Fri, 14 Feb 2020 16:35:58 +0100"),
      userId: "buildservice-autocommit",
      commitMessage: "baserev update by copy to link target",
      requestId: 769042
    },
    {
      revision: 11,
      versionRevision: 13,
      revisionHash: "f09465fd156e74d3e6673dbb60b9409c",
      commitTime: new Date("Mon, 16 Mar 2020 13:10:53 +0100"),
      userId: "dancermak",
      commitMessage: "New upstream release 1.3.4",
      requestId: 785606
    }
  ].map((entry) => ({ ...entry, ...commonEntries }))
);

export const dotChangesRev1 = `-------------------------------------------------------------------
Tue Sep 17 21:34:25 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Add working testsuite subpackage

-------------------------------------------------------------------
Thu Mar 14 14:51:58 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Initial package version
`;

const dotChangesRev3 =
  `-------------------------------------------------------------------
Fri Sep 27 20:34:04 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Fix in testsuite.sh:
  Ignore the return value of vagrant destroy -f in the cleanup function, so that
  all cleanup tasks run even if vagrant destroy fails

`.concat(dotChangesRev1);

const dotChangesRev5 =
  `-------------------------------------------------------------------
Wed Oct  9 10:12:50 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Fix vagrant box name in testsuite.sh

`.concat(dotChangesRev3);

const dotChangesRev7 =
  `-------------------------------------------------------------------
Thu Nov  7 21:05:53 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Add missing sshfs dependency

`.concat(dotChangesRev5);

const dotChangesRev9 =
  `-------------------------------------------------------------------
Wed Jan 29 08:51:07 UTC 2020 - Dan Čermák <dcermak@suse.com>

- New upstream release 1.3.3

  v1.3.3:
  * RELEASE.txt: Updates to release process
  * synced_folder: gentoo: Update path to look for sftp-server
  * version: bump to 1.3.3

  v1.3.2:
  * remove tests - add build script
  * Fix some errors when building
  * Updates to build/release instructions
  * Update vagrant and vagrant-libvirt in Gemfile
  * Remove the build Vagrantfile
  * Run the build.sh script inside a buildah unshare session
  * guest: make alpine fuse module loading match what we do for freebsd
  * tests: update Vagrantfile to be Fedora 31
  * version: bump to 1.3.2
  * guest: Add alpine support
  * Add note for windows users to use cygwin shell.

- Drop patches:
  * 0001-Bump-testing-Vagrant-box-version.patch
  * 0001-remove-win32-dep.patch

- Add gpg source verification
- Drop not required dependencies on the rubygems mime-types, builder and ffi

`.concat(dotChangesRev7);

const dotChangesRev11 =
  `-------------------------------------------------------------------
Mon Mar 16 12:01:33 UTC 2020 - Dan Čermák <dcermak@suse.com>

- New upstream release 1.3.4

  * guest: redhat: use yum to install epel-release
  * guest: redhat: pull fuse-sshfs from PowerTools repo on el8
  * guest: redhat: handle missing el8 version detection in vagrant
  * Update vagrant in Gemfile
  * RELEASE: update some release instructions
  * version: bump to 1.3.4

`.concat(dotChangesRev9);

const dotChangesRev13 =
  `-------------------------------------------------------------------
Tue Mar 31 06:49:51 UTC 2020 - Guillaume GARDET <guillaume.gardet@opensuse.org>

- Fix vagrant-ssh-testsuite for aarch64 by using`.concat(
    // there is a trailing whitespace that prettier will apparently always remove -.-
    " ",
    `
  opensuse/Tumbleweed.$(uname -m) instead of fedora box which is
  for x86_64 only

`,
    dotChangesRev11
  );

const dotChangesRev15 =
  `-------------------------------------------------------------------
Wed Apr  1 20:38:10 UTC 2020 - Dan Čermák <dcermak@suse.com>

- Fix test suite failures (boo#1168371)

  The testsuite was implicitly assuming that /sbin/ is a symlink to /usr/sbin
  (which is the case on Fedora, but not on opensuse). By switching to the
  /var/run -> /run symlink, we fix this issue.

  Also, the sed call in the spec file to change the Fedora box to
  opensuse/Tumbleweed.$(uname -m) got removed and instead was moved into the
  packaged Vagrantfile.

  Added patches:
  * 0001-Use-var-run-run-symlink-for-tests.patch
  * 0002-Use-opensuse-Tumbleweed.-uname-m-box-instead-of-Fedo.patch

`.concat(dotChangesRev13);

const dotChangesRev17 =
  `-------------------------------------------------------------------
Tue May 12 15:31:27 UTC 2020 - Dan Čermák <dcermak@suse.com>

- Switch to Ruby 2.6 for Tumbleweed

`.concat(dotChangesRev15);

export const vagrantSshfsDotChanges: PackageFile = Object.freeze({
  name: "vagrant-sshfs.changes",
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs"
});

export const vagrantSshfsDotChangesContents = Buffer.from(dotChangesRev17);

export const vagrantSshfsDotChangesFileHistory: string[] = Object.freeze([
  dotChangesRev1,
  dotChangesRev1,
  dotChangesRev3,
  dotChangesRev3,
  dotChangesRev5,
  dotChangesRev5,
  dotChangesRev7,
  dotChangesRev7,
  dotChangesRev9,
  dotChangesRev9,
  dotChangesRev11,
  dotChangesRev11,
  dotChangesRev13,
  dotChangesRev13,
  dotChangesRev15,
  dotChangesRev15,
  dotChangesRev17
]) as string[];

export const virtualizationVagrant: Project = {
  apiUrl: "https://api.opensuse.org/",
  name: "Virtualization:vagrant",
  meta: {
    name: "Virtualization:vagrant",
    title: "Devel project for Vagrant",
    description: "This is the factory development project for Vagrant",
    person: [
      { id: "dancermak", role: LocalRole.Bugowner },
      { id: "ojkastl_buildservice", role: LocalRole.Bugowner },
      { id: "dancermak", role: LocalRole.Maintainer },
      { id: "dirkmueller", role: LocalRole.Maintainer },
      { id: "ojkastl_buildservice", role: LocalRole.Maintainer }
    ],
    build: {
      defaultValue: DefaultValue.Enable,
      enable: [
        { repository: "SLE_12_SP1" },
        { repository: "SLE_12_SP2" },
        { repository: "SLE_12_SP3" },
        { repository: "SLE_12_SP4" }
      ],
      disable: [{ repository: "openSUSE_Tumbleweed_default_ruby" }]
    },
    publish: {
      defaultValue: DefaultValue.Enable,
      enable: [],
      disable: [
        { repository: "openSUSE_Tumbleweed_and_d_l_r_e" },
        { repository: "openSUSE_Tumbleweed_default_ruby" }
      ]
    },
    debugInfo: {
      defaultValue: DefaultValue.Unspecified,
      enable: [],
      disable: []
    },
    useForBuild: {
      defaultValue: DefaultValue.Unspecified,
      enable: [],
      disable: [
        { repository: "openSUSE_Tumbleweed_default_ruby" },
        { repository: "openSUSE_Tumbleweed_and_d_l_r_e" }
      ]
    },
    repository: [
      {
        arch: [Arch.X86_64],
        name: "openSUSE_Tumbleweed_default_ruby",
        path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
      },
      {
        arch: [Arch.X86_64],
        name: "openSUSE_Tumbleweed_and_d_l_r_e",
        path: [
          {
            project: "devel:languages:ruby:extensions",
            repository: "openSUSE_Tumbleweed"
          },
          { project: "openSUSE:Factory", repository: "snapshot" }
        ]
      },
      {
        arch: [Arch.I586, Arch.X86_64],
        name: "openSUSE_Tumbleweed",
        path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
      },
      {
        name: "openSUSE_Leap_15.2",
        arch: [Arch.X86_64],
        path: [{ project: "openSUSE:Leap:15.2", repository: "standard" }]
      },
      {
        name: "openSUSE_Leap_15.1_ARM",
        arch: [Arch.Aarch64, Arch.Armv7l],
        path: [{ project: "openSUSE:Leap:15.1:ARM", repository: "ports" }]
      },
      {
        name: "openSUSE_Leap_15.1",
        arch: [Arch.X86_64],
        path: [{ project: "openSUSE:Leap:15.1", repository: "standard" }]
      },
      {
        name: "openSUSE_Leap_15.0",
        arch: [Arch.X86_64],
        path: [{ project: "openSUSE:Leap:15.0", repository: "standard" }]
      },
      {
        name: "openSUSE_Factory_ARM",
        arch: [Arch.Armv7l, Arch.Aarch64],
        path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }]
      },
      {
        name: "SLE_15-SP1",
        arch: [Arch.X86_64, Arch.Aarch64],
        path: [{ project: "SUSE:SLE-15-SP1:GA", repository: "standard" }]
      },
      {
        name: "SLE_15",
        arch: [Arch.X86_64, Arch.Aarch64],
        path: [{ project: "SUSE:SLE-15:GA", repository: "standard" }]
      }
    ]
  }
};

const baseFile = {
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs"
};

export const vagrantSshfsDotChangesWithExtraFields = {
  ...vagrantSshfsDotChanges,
  md5Hash: "2f8fce37f601e56d459ad30787ab9532",
  size: 3534,
  modifiedTime: new Date("Tue, 12 May 2020 17:31:36 +0200")
};

const vagrantSshfsFileList: FrozenPackageFile[] = [
  {
    name: "0001-Use-var-run-run-symlink-for-tests.patch",
    md5Hash: "aa67a02848aa376bcfe4b592e68fcfa7",
    size: 1774,
    modifiedTime: new Date("Wed, 01 Apr 2020 22:49:18 +0200")
  },
  {
    name: "0002-Use-opensuse-Tumbleweed.-uname-m-box-instead-of-Fedo.patch",
    md5Hash: "cb8759e4f95d2e9976b3cc45439d75ab",
    size: 836,
    modifiedTime: new Date("Wed, 01 Apr 2020 22:49:20 +0200")
  },
  {
    name: "testsuite.sh",
    md5Hash: "49f6bfd714eb157c56a6cf78c22e6ff3",
    size: 1503,
    modifiedTime: new Date("Wed, 01 Apr 2020 22:49:20 +0200")
  },
  {
    name: "vagrant-sshfs-1.3.4.tar.gz",
    md5Hash: "9de559bf9dcf0b9af4f2d0dd96663a34",
    size: 27579,
    modifiedTime: new Date("Mon, 16 Mar 2020 13:03:27 +0100")
  },
  {
    name: "vagrant-sshfs-1.3.4.tar.gz.asc",
    md5Hash: "55600e43b3c7ab4286e3d94d8b4e4b90",
    size: 833,
    modifiedTime: new Date("Mon, 16 Mar 2020 13:03:27 +0100")
  },
  vagrantSshfsDotChangesWithExtraFields,
  {
    name: "vagrant-sshfs.keyring",
    md5Hash: "f868df2487146cd0b2a716014e62f4a0",
    size: 32547,
    modifiedTime: new Date("Wed, 29 Jan 2020 11:07:33 +0100")
  },
  {
    name: "vagrant-sshfs.spec",
    md5Hash: "b0eb5911e23c6c99baf22f1e85f7a620",
    size: 4329,
    modifiedTime: new Date("Tue, 12 May 2020 17:31:36 +0200")
  }
].map((f) =>
  Object.freeze({ ...f, ...baseFile, contents: Buffer.from(f.name) })
);

export const vagrantSshfs = {
  apiUrl: "https://api.opensuse.org/",
  name: "vagrant-sshfs",
  projectName: "Virtualization:vagrant",
  md5Hash: "67206eaa7b5ce4691d09fafb0d849142",
  sourceLink: {
    project: "openSUSE:Factory",
    package: "vagrant-sshfs",
    srcmd5: "eeb0cd1461e64b5d6df871d11f406aed",
    baserev: "eeb0cd1461e64b5d6df871d11f406aed",
    lsrcmd5: "9ab168efd2fc2b2bc946ab0e4296453c"
  },
  meta: {
    name: "vagrant-sshfs",
    project: "Virtualization:vagrant",
    title: "SSHFS synced folder implementation for Vagrant",
    description: `This Vagrant plugin adds synced folder support for mounting folders from the
Vagrant host into the Vagrant guest via SSHFS. In the default mode it does this
by executing the SSHFS client software within the guest, which creates an SSH
connection from the Vagrant guest back to the Vagrant host.

`,
    person: [
      {
        id: "dancermak",
        role: LocalRole.Bugowner
      },
      {
        id: "dancermak",
        role: LocalRole.Maintainer
      }
    ],
    url: "https://github.com/dustymabe/vagrant-sshfs"
  },
  files: vagrantSshfsFileList
};

export function setupProjectFsMocks(
  targetDir: string,
  additionalSettings?: any
): void {
  const options: any = {
    "test/.osc/_apiurl": `https://api.example.org
`,
    "test/.osc/_project": `test
`,
    "test/.osc/_packages": `<project name="test" />
`,

    "onePackage/.osc/_apiurl": `https://api.example.org/`,
    "onePackage/.osc/_project": "justOnePackageInThisProject",
    "onePackage/.osc/_packages": `<project name="test"><package name="jtc" state=" "/></project>`,

    noDotOsc: mockFs.directory({ items: {} }),
    noUnderscorePackage: mockFs.directory({
      items: {
        ".osc": mockFs.directory({
          items: { _project: "foo", _apiurl: "https://api.foo.org" }
        })
      }
    })
  };

  const addVirtApplImg = (dirName: string) => {
    // the following files have been taken from a checked out copy of the
    // project Virtualization:Appliances:Images:openSUSE-Tumbleweed
    options[`${dirName}/.osc/_apiurl`] = `https://api.opensuse.org
`;
    options[
      `${dirName}/.osc/_project`
    ] = `Virtualization:Appliances:Images:openSUSE-Tumbleweed
`;
    options[
      `${dirName}/.osc/_packages`
    ] = `<project name="Virtualization:Appliances:Images:openSUSE-Tumbleweed">
  <package name="live-kiwi-hook" state=" " />
  <package name="livecd-openSUSE" state=" " />
  <package name="kiwi-images-vagrant" state=" " />
  <package name="kiwi-templates-JeOS" state=" " />
</project>`;
  };

  addVirtApplImg(targetDir);
  addVirtApplImg(`${targetDir}_with_meta`);

  options[
    `${targetDir}_with_meta/.osc_obs_ts/_project_meta.json`
  ] = `{"name":"Virtualization:Appliances:Images:openSUSE-Tumbleweed","title":"openSUSE Tumbleweed Images","description":"Contains the Live CD, JeOS, Vagrant boxes and possibly more.","person":[{"id":"dancermak","role":"maintainer"},{"id":"dcassany","role":"maintainer"},{"id":"favogt","role":"maintainer"},{"id":"gmoro","role":"maintainer"}],"repository":[{"name":"rpm","path":[{"project":"openSUSE:Factory","repository":"snapshot"}],"arch":["x86_64","i586"]},{"name":"openSUSE_Tumbleweed_vanilla","path":[{"project":"openSUSE:Factory","repository":"snapshot"}],"arch":["x86_64"]},{"name":"openSUSE_Tumbleweed_ARM","path":[{"project":"openSUSE:Factory:ARM","repository":"standard"}],"arch":["aarch64"]},{"name":"openSUSE_Tumbleweed","path":[{"project":"Virtualization:Appliances:Images:openSUSE-Tumbleweed","repository":"rpm"},{"project":"openSUSE:Factory","repository":"snapshot"}],"arch":["x86_64","i586"]}]}`;

  mockFs({ ...options, ...additionalSettings });
}
