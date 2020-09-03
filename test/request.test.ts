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

import { describe, it } from "mocha";
import {
  ApiType,
  getTestConnection,
  beforeEachRecord,
  afterEachRecord
} from "./test-setup";
import {
  fetchRequest,
  Request,
  RequestActionType,
  State,
  SourceUpdate,
  fetchRequestDiff,
  RequestAction
} from "../src/request";
import { expect } from "chai";

describe("Request", function () {
  this.timeout(10000);
  const con = getTestConnection(ApiType.Production);

  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  describe("#fetchRequest", () => {
    it("correctly parses SR#821652", async () => {
      const sr821652: Request = {
        id: 821652,
        creatorUserId: "Pharaoh_Atem",
        description:
          "Initial packaging of repository definition for dnf, so that dnf gets a comparable out of the box experience to zypper",
        state: {
          state: State.Superseded,
          userId: "Pharaoh_Atem",
          time: new Date("2020-07-21T12:48:45"),
          supersededBy: 822097,
          comment: "superseded by 822097"
        },
        history: [],
        actions: [
          {
            type: RequestActionType.Submit,
            source: {
              projectName: "Base:System",
              packageName: "rpm-repos-openSUSE",
              revision: "3"
            },
            target: {
              projectName: "openSUSE:Factory",
              packageName: "rpm-repos-openSUSE"
            }
          }
        ],
        reviews: [
          {
            state: State.Accepted,
            reviewedAt: new Date("2020-07-18T14:23:54"),
            requestedReviewer: { userId: "licensedigger" },
            reviewedBy: "licensedigger",
            comment: "ok",
            reviewHistory: [
              {
                time: new Date("2020-07-18T14:31:09"),
                userId: "licensedigger",
                description: "Review got accepted",
                comment: "ok"
              }
            ]
          },
          {
            state: State.Accepted,
            reviewedAt: new Date("2020-07-18T14:23:54"),
            reviewedBy: "factory-auto",
            requestedReviewer: { userId: "factory-auto" },
            comment: "Check script succeeded",
            reviewHistory: [
              {
                userId: "factory-auto",
                time: new Date("2020-07-18T14:25:58"),
                description: "Review got accepted",
                comment: "Check script succeeded"
              }
            ]
          },
          {
            state: State.Accepted,
            reviewedAt: new Date("2020-07-18T14:23:54"),
            reviewedBy: "dimstar_suse",
            requestedReviewer: { groupId: "factory-staging" },
            comment: 'Picked "openSUSE:Factory:Staging:adi:8"',
            reviewHistory: [
              {
                userId: "dimstar_suse",
                time: new Date("2020-07-18T16:32:36"),
                description: "Review got accepted",
                comment: 'Picked "openSUSE:Factory:Staging:adi:8"'
              }
            ]
          },
          {
            state: State.New,
            reviewedAt: new Date("2020-07-18T14:25:57"),
            reviewedBy: "factory-auto",
            requestedReviewer: { groupId: "opensuse-review-team" },
            comment: "Please review sources",
            reviewHistory: []
          },
          {
            state: State.New,
            reviewedAt: new Date("2020-07-18T16:32:34"),
            reviewedBy: "dimstar_suse",
            requestedReviewer: {
              projectName: "openSUSE:Factory:Staging:adi:8"
            },
            comment:
              'Being evaluated by staging project "openSUSE:Factory:Staging:adi:8"',
            reviewHistory: []
          }
        ]
      };

      await fetchRequest(con, 821652).should.eventually.deep.equal(sr821652);
    });

    it("correctly parses delete request 818909", async () => {
      const id = 818909;
      const delReq818909: Request = {
        id,
        creatorUserId: "Admin",
        actions: [
          {
            type: RequestActionType.Delete,
            target: { projectName: "home:favogt:branches:hardware:boot" }
          }
        ],
        state: {
          state: State.Accepted,
          time: new Date("2020-07-06T06:26:32"),
          userId: "favogt",
          comment: ""
        },
        autoAcceptAt: new Date("2020-08-05 07:20:01 UTC"),
        description: `This is a humble request to remove this project.
Accepting this request will free resources on our always crowded server.
Please decline this request if you want to keep this repository nevertheless. Otherwise this request
will get accepted automatically in near future.
Such requests get not created for projects with open requests or if you remove the OBS:AutoCleanup attribute.`,
        history: [],
        reviews: []
      };

      await fetchRequest(con, id).should.eventually.deep.equal(delReq818909);
    });

    it("correctly parses a SR with a sourceupdate and expanded md5 hashes", async () => {
      const id = 819474;
      const req = await fetchRequest(con, id);

      req.id.should.equal(id);

      expect(req.actions).to.be.an("array").and.have.length(1);
      expect(req.actions[0].options).to.deep.equal({
        sourceUpdate: SourceUpdate.Cleanup
      });
      expect(req.actions[0].acceptInfo).to.deep.equal({
        revision: "53",
        sourceMd5: "35736f57de621ed41bc0ec291c56dfc3",
        originalSourceMd5: "e817a61629d70071f6e54ed192c284de",
        expandedSourceMd5: "b5ae7a559bf25d6600a3d944ea179da2",
        originalExpandedSourceMd5: "bd303a838f956dba045f38e7edd62313"
      });
    });

    it("correctly parses the by_package & by_project entry", async () => {
      const id = 821755;
      const req = await fetchRequest(con, id);

      req.id.should.equal(id);
      expect(req.reviews).to.be.an("array").and.have.length(1);
      expect(req.reviews[0]).to.deep.equal({
        state: State.Accepted,
        reviewedAt: new Date("2020-07-19T10:47:43"),
        reviewedBy: "pluskalm",
        requestedReviewer: {
          projectName: "devel:tools:building",
          packageName: "automake"
        },
        comment: "",
        reviewHistory: [
          {
            userId: "pluskalm",
            time: new Date("2020-07-21T08:56:50"),
            description: "Review got accepted"
          }
        ]
      });
    });

    it("correctly parses maintenance releases", async () => {
      const id = 821665;
      const req = await fetchRequest(con, id);

      const actions: RequestAction[] = [
        {
          type: RequestActionType.MaintenanceRelease,
          source: {
            projectName: "openSUSE:Maintenance:13398",
            packageName: "kio.openSUSE_Leap_15.2_Update"
          },
          target: {
            projectName: "openSUSE:Leap:15.2:Update",
            packageName: "kio.13398"
          },
          acceptInfo: {
            revision: "1",
            sourceMd5: "f9b7d2377f4570722e8712789cf1643b",
            originalProject: "openSUSE:Leap:15.2:Update",
            originalPackage: "kio.13361",
            originalSourceMd5: "945632987b4ab82676378614c3ee2744",
            originalExpandedSourceMd5: "945632987b4ab82676378614c3ee2744"
          }
        },
        {
          type: RequestActionType.MaintenanceRelease,
          source: {
            projectName: "openSUSE:Maintenance:13398",
            packageName: "patchinfo"
          },
          target: {
            projectName: "openSUSE:Leap:15.2:Update",
            packageName: "patchinfo.13398"
          },

          acceptInfo: {
            revision: "1",
            sourceMd5: "33725b30725dc175a5d7c68bd3ed9d0c",
            originalSourceMd5: "d41d8cd98f00b204e9800998ecf8427e"
          }
        }
      ];

      req.id.should.equal(id);
      expect(req.actions).to.deep.equal(actions);
    });
  });

  describe("#fetchRequestDiff", () => {
    it("retrieves the diff of a submitrequest", async () => {
      // need to do the stupid concat() because prettier will be so nice and
      // remove trailing whitespace for us…
      await fetchRequestDiff(con, 821114).should.eventually.deep.equal(
        `
changes files:
--------------
--- i3.changes
+++ i3.changes
@@ -1,0 +2,8 @@
+Wed Jul 15 14:31:53 UTC 2020 - Dan Čermák <dcermak@suse.com>
+
+- packaging changes:
+  * use https everywhere
+  * switch to %autosetup
+  * Recommend xorg-x11-server
+
+-------------------------------------------------------------------

spec files:
-----------
--- i3.spec
+++ i3.spec
@@ -22,8 +22,8 @@
 Summary:        Tiling window manager
 License:        BSD-3-Clause
 Group:          System/GUI/Other
-URL:            http://i3wm.org/
-Source0:        http://i3wm.org/downloads/%{name}-%{version}.tar.bz2
+URL:            https://i3wm.org/
+Source0:        https://i3wm.org/downloads/%{name}-%{version}.tar.bz2
 Source1:        %{name}.png
 Source2:        %{name}.keyring
 Source3:        https://i3wm.org/downloads/%{name}-%{version}.tar.bz2.asc
@@ -60,6 +60,7 @@
 Recommends:     dmenu
 Recommends:     i3lock
 Recommends:     i3status
+Recommends:     xorg-x11-server
 Provides:       windowmanager
 # Upstream First - Policy:
 # Never add any patches to this package without the upstream commit id
@@ -81,8 +82,7 @@
 Development headers for the i3 window manager.
 `.concat(
          `
 %prep
-%setup -q
-%patch1 -p1
+%autosetup -p1
 `,
          `
 # fix rpmlint E: env-script-interpreter
 sed -i 's,^#!/usr/bin/env ,#!/usr/bin/,' i3-dmenu-desktop i3-migrate-config-to-v4 i3-save-tree
`
        )
      );
    });
  });
});
