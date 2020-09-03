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
import { describe, it } from "mocha";
import { deleteFile } from "../../src/file";
import { branchPackage, Package, PackageWithMeta } from "../../src/package";
import { deleteProject } from "../../src/project";
import {
  createRequest,
  fetchRequest,
  fetchRequestDiff,
  Request,
  RequestActionType,
  RequestCreation,
  requestDeletion,
  RequestReview,
  SourceUpdate,
  State,
  submitPackage
} from "../../src/request";
import { LocalRole } from "../../src/user";
import { sleep } from "../../src/util";
import {
  ApiType,
  getTestConnection,
  miniObsAdminCon,
  miniObsUsername,
  removeProjectRepositories,
  skipIfNoMiniObsHook,
  swallowException
} from "../test-setup";

describe("Request", function () {
  this.timeout(30000);
  before(skipIfNoMiniObsHook);

  const con = getTestConnection(ApiType.MiniObs);

  const packageName = "ccls";
  let branchedPackage: PackageWithMeta;
  const originalPackage = {
    apiUrl: con.url,
    name: packageName,
    projectName: "openSUSE.org:devel:tools"
  };

  beforeEach(async () => {
    // ensure that the project is *really* gone
    await swallowException(
      deleteProject,
      con,
      `home:${miniObsUsername}:branches:${originalPackage.projectName}`
    );

    branchedPackage = await branchPackage(con, originalPackage);
    await removeProjectRepositories(con, branchedPackage.projectName);
  });

  afterEach(async () => {
    await swallowException(deleteProject, con, branchedPackage.projectName);
    // wait for the obs backend to realize that the branched package is gone
    await sleep(2000);
  });

  describe("#requestDeletion", () => {
    it("creates a new package delete request", async () => {
      const target = {
        projectName: branchedPackage.projectName,
        packageName: branchedPackage.name
      };
      const newReq: RequestCreation = {
        actions: [
          {
            type: RequestActionType.Delete,
            target
          }
        ],
        reviews: []
      };
      const req = await requestDeletion(con, branchedPackage);

      req.should.deep.include({
        ...newReq,
        creatorUserId: miniObsUsername
      });
      expect(req.id).to.be.a("number");
      expect(req.state).to.deep.include({
        userId: miniObsUsername,
        state: State.New
      });

      await fetchRequest(con, req.id).should.eventually.deep.equal(req);
    });

    it("creates a new project delete request", async () => {
      const target = {
        projectName: branchedPackage.projectName
      };

      const newReq = {
        actions: [
          {
            type: RequestActionType.Delete,
            target
          }
        ]
      };
      const req = await requestDeletion(con, target);

      req.should.deep.include({
        ...newReq,
        creatorUserId: miniObsUsername
      });
      expect(req.id).to.be.a("number");
      expect(req.state).to.deep.include({
        userId: miniObsUsername,
        state: State.New
      });

      await fetchRequest(con, req.id).should.eventually.deep.equal(req);
    });

    it("creates a deletion request with an auto acceptance date", async () => {
      const in2sec = new Date();
      in2sec.setSeconds(in2sec.getSeconds() + 2);
      in2sec.setMilliseconds(0);
      const req = await requestDeletion(
        miniObsAdminCon,
        branchedPackage,
        in2sec
      );
      expect(req.autoAcceptAt).to.deep.equal(in2sec);
      req.creatorUserId.should.equal(miniObsAdminCon.username);

      // compare it with the fetched one, ensuring that the dates are correct
      await fetchRequest(con, req.id).should.eventually.deep.equal(req);
    });
  });

  describe("#submitPackage", () => {
    let branchedBranchedPackage: Package;
    beforeEach(async () => {
      // ensure that the project is *really* gone
      await swallowException(
        deleteProject,
        con,
        `home:${miniObsUsername}:branches:${branchedPackage.projectName}`
      );

      branchedBranchedPackage = await branchPackage(con, {
        apiUrl: con.url,
        name: packageName,
        projectName: branchedPackage.projectName
      });
      await removeProjectRepositories(con, branchedBranchedPackage.projectName);
    });

    afterEach(async () => {
      await swallowException(
        deleteProject,
        con,
        branchedBranchedPackage.projectName
      );
      // wait for the obs backend to realize that the branched package is gone
      await sleep(2000);
    });

    it("creates a new submit request", async () => {
      // create a dummy commit so that we can actually perform a submitrequest
      await deleteFile(con, {
        projectName: branchedBranchedPackage.projectName,
        packageName: branchedBranchedPackage.name,
        name: "ccls.spec"
      });

      const target = {
        projectName: branchedPackage.projectName,
        packageName: branchedPackage.name
      };
      const source = {
        projectName: branchedBranchedPackage.projectName,
        packageName: branchedBranchedPackage.name
      };
      const newReq: Request = {
        actions: [
          {
            type: RequestActionType.Submit,
            target,
            source
          }
        ],
        reviews: [],
        history: []
      };

      const req = await submitPackage(con, source, target);

      const { actions, ...rest } = newReq;
      req.should.deep.include({
        ...rest,
        actions: [
          { ...actions[0], options: { sourceUpdate: SourceUpdate.Cleanup } }
        ],
        creatorUserId: miniObsUsername
      });
      expect(req.id).to.be.a("number");
      expect(req.state).to.deep.include({
        userId: miniObsUsername,
        state: State.New
      });

      const { state, ...restOfReq } = await fetchRequest(con, req.id);

      // we have to omit comparing the time field in state due to a bug in OBS:
      // https://github.com/openSUSE/open-build-service/issues/9954
      const { state: origState, ...restOfOrigReq } = req;

      const { time, ...restOfState } = state!;
      const { time: _ignoreMe, ...restOfOrigState } = origState!;

      restOfOrigReq.should.deep.equal(restOfReq);
      restOfState.should.deep.equal(restOfOrigState);

      await fetchRequestDiff(con, req.id).should.eventually.include(
        "ccls.spec"
      );
    });
  });

  describe("#createRequest", () => {
    it("correctly attaches a review to a request", async () => {
      const target = {
        projectName: branchedPackage.projectName,
        packageName: branchedPackage.name
      };
      const groupReview: RequestReview = {
        state: State.New,
        requestedReviewer: { groupId: "testers" },
        reviewHistory: []
      };
      const userReview: RequestReview = {
        state: State.New,
        requestedReviewer: { userId: "Admin" },
        reviewHistory: []
      };
      const packageReview: RequestReview = {
        state: State.New,
        requestedReviewer: target,
        reviewHistory: []
      };
      const projectReview: RequestReview = {
        state: State.New,
        requestedReviewer: { projectName: `home:${miniObsUsername}` },
        reviewHistory: []
      };
      const newReq: Request = {
        actions: [
          {
            type: RequestActionType.AddRole,
            target,
            person: { id: miniObsUsername, role: LocalRole.Downloader }
          }
        ],
        reviews: [groupReview, userReview, packageReview, projectReview],
        history: []
      };

      const req = await createRequest(con, newReq);

      expect(req.actions).to.deep.equal(newReq.actions);
      expect(req.reviews)
        .to.be.an("array")
        .and.have.length(newReq.reviews.length);
      newReq.reviews.forEach((rev, i) => {
        req.reviews[i].should.deep.include(rev);
      });

      await fetchRequest(con, req.id).should.eventually.deep.equal(req);
    });
  });
});
