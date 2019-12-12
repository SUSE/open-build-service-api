import { afterEach, beforeEach, describe, it } from "mocha";
import { fetchRevisions } from "./../../src/revision";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  //  checkApiCallSucceeds,
  getTestConnection
} from "./../test-setup";
import { vagrantSshfsHistory } from "./data";

describe("Revision", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  describe("#fetchRevisions", () => {
    it("fetches the revisions of Virtualization:vagrant/vagrant-sshfs correctly", async () => {
      await fetchRevisions(
        con,
        "Virtualization:vagrant",
        "vagrant-sshfs"
      ).should.be.fulfilled.and.eventually.deep.equal(vagrantSshfsHistory);
    });

    it("fetches the revisions of Virtualization:vagrant/vagrant-sshfs when invoked via Project and Package objects", async () => {
      await fetchRevisions(
        con,
        { apiUrl: con.url, name: "Virtualization:vagrant" },
        { name: "vagrant-sshfs", project: "Virtualization:vagrant" }
      ).should.be.fulfilled.and.eventually.deep.equal(vagrantSshfsHistory);
    });

    it("omits requestId when a commit was made directly", async () => {
      const hist = await fetchRevisions(con, "devel:tools", "ccls").should.be
        .fulfilled;

      hist.should.include.a.thing.that.deep.equals({
        revision: 2,
        versionRevision: 2,
        md5Hash: "94baa213ad0f95c6d3893c3a5e929771",
        version: "0.20190314",
        commitTime: new Date("Wed, 10 Apr 2019 22:42:27 +0200"),
        userId: "dancermak",
        comment: "run format_spec_file"
      });
    });

    it("omits the userId when the user is not known", async () => {
      const hist = await fetchRevisions(con, "openSUSE:Factory", "make").should
        .be.fulfilled;

      hist.should.contain.a.thing.that.deep.equals({
        revision: 1,
        versionRevision: 16,
        md5Hash: "74349037c1f2d2d21a09f17d419d8906",
        version: "3.81",
        commitTime: new Date("Tue, 19 Dec 2006 00:17:05 +0100")
      });
      hist[0].should.not.have.property("userId");
    });
  });
});
