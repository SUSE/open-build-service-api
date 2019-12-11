import { Revision } from "./../../src/revision";
import { PackageFile } from "./../../src/file";

export const vagrantSshfsHistory: Revision[] = [
  {
    revision: 1,
    versionRevision: 1,
    md5Hash: "c4458905a38f029e0572e848e8083eb5",
    version: "1.3.1",
    commitTime: new Date("Sun, 22 Sep 2019 13:22:55 +0200"),
    userId: "ojkastl_buildservice",
    comment: "Create a RPM package of the vagrant-sshfs plugin",
    requestId: 731596
  },
  {
    revision: 2,
    versionRevision: 2,
    md5Hash: "37609c2ee2308324c2112d0b0ec406b5",
    commitTime: new Date("Wed, 25 Sep 2019 08:22:59 +0200"),
    userId: "dimstar_suse",
    comment: "initialized devel package after accepting 732747",
    requestId: 732747
  },
  {
    revision: 3,
    versionRevision: 3,
    md5Hash: "49e027533df2ff4849938bf30e7514a9",
    commitTime: new Date("Tue, 01 Oct 2019 15:23:11 +0200"),
    userId: "dancermak",
    comment:
      "Fix for testsuite.sh's cleanup function: don't fail when vagrant destroy fails",
    requestId: 733761
  },
  {
    revision: 4,
    versionRevision: 4,
    md5Hash: "ddb63f844f1ccd05f4b9f0a935fdcbdf",
    commitTime: new Date("Wed, 02 Oct 2019 12:00:08 +0200"),
    userId: "buildservice-autocommit",
    comment: "baserev update by copy to link target",
    requestId: 734337
  },
  {
    revision: 5,
    versionRevision: 5,
    md5Hash: "cf7d64af5cadf92bb2dc23f7c24b5017",
    commitTime: new Date("Fri, 11 Oct 2019 12:22:03 +0200"),
    userId: "dancermak",
    comment: "Fix vagrant box name in testsuite.sh",
    requestId: 736437
  },
  {
    revision: 6,
    versionRevision: 6,
    md5Hash: "28d92afc8c7bd32db4f253c5648f2ac4",
    commitTime: new Date("Fri, 11 Oct 2019 15:22:37 +0200"),
    userId: "buildservice-autocommit",
    comment: "baserev update by copy to link target",
    requestId: 737442
  },
  {
    revision: 7,
    versionRevision: 7,
    md5Hash: "72e98a790ed85a09fad7cc2f4d535542",
    commitTime: new Date("Thu, 07 Nov 2019 22:12:32 +0100"),
    userId: "dancermak",
    comment: "Add missing sshfs dependency",
    requestId: 746422
  },
  {
    revision: 8,
    versionRevision: 8,
    md5Hash: "5674645a0f6536aa31be9af2dbca8586",
    commitTime: new Date("Fri, 08 Nov 2019 15:26:53 +0100"),
    userId: "buildservice-autocommit",
    comment: "baserev update by copy to link target",
    requestId: 746427
  }
];

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

export const vagrantSshfsDotChanges: PackageFile = {
  name: "vagrant-sshfs.changes",
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs",
  contents: dotChangesRev7
};

export const vagrantSshfsDotChangesFileHistory: Array<[Revision, string]> = [
  [vagrantSshfsHistory[0], dotChangesRev1],
  [vagrantSshfsHistory[1], dotChangesRev1],
  [vagrantSshfsHistory[2], dotChangesRev3],
  [vagrantSshfsHistory[3], dotChangesRev3],
  [vagrantSshfsHistory[4], dotChangesRev5],
  [vagrantSshfsHistory[5], dotChangesRev5],
  [vagrantSshfsHistory[6], dotChangesRev7],
  [vagrantSshfsHistory[7], dotChangesRev7]
];
