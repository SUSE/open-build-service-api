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

import { PackageFile } from "./../../src/file";
import { Revision } from "./../../src/history";

const commonEntries = {
  expanded: false,
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
  ].map(entry => ({ ...entry, ...commonEntries }))
);

const dotChangesRev1 = `-------------------------------------------------------------------
Tue Sep 17 21:34:25 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Add working testsuite subpackage

-------------------------------------------------------------------
Thu Mar 14 14:51:58 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Initial package version
`;

const dotChangesRev3 = `-------------------------------------------------------------------
Fri Sep 27 20:34:04 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Fix in testsuite.sh:
  Ignore the return value of vagrant destroy -f in the cleanup function, so that
  all cleanup tasks run even if vagrant destroy fails

`.concat(dotChangesRev1);

const dotChangesRev5 = `-------------------------------------------------------------------
Wed Oct  9 10:12:50 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Fix vagrant box name in testsuite.sh

`.concat(dotChangesRev3);

const dotChangesRev7 = `-------------------------------------------------------------------
Thu Nov  7 21:05:53 UTC 2019 - Dan Čermák <dcermak@suse.com>

- Add missing sshfs dependency

`.concat(dotChangesRev5);

const dotChangesRev9 = `-------------------------------------------------------------------
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

const dotChangesRev11 = `-------------------------------------------------------------------
Mon Mar 16 12:01:33 UTC 2020 - Dan Čermák <dcermak@suse.com>

- New upstream release 1.3.4

  * guest: redhat: use yum to install epel-release
  * guest: redhat: pull fuse-sshfs from PowerTools repo on el8
  * guest: redhat: handle missing el8 version detection in vagrant
  * Update vagrant in Gemfile
  * RELEASE: update some release instructions
  * version: bump to 1.3.4

`.concat(dotChangesRev9);

export const vagrantSshfsDotChanges: PackageFile = Object.freeze({
  name: "vagrant-sshfs.changes",
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs"
});

export const vagrantSshfsDotChangesContents = Object.freeze(dotChangesRev11);

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
  dotChangesRev11
]) as string[];
