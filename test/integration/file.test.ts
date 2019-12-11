import { afterEach, beforeEach, describe, it } from "mocha";
import { fetchFileHistory } from "./../../src/file";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";
import {
  vagrantSshfsDotChanges,
  vagrantSshfsDotChangesFileHistory,
  vagrantSshfsHistory
} from "./data";

describe("File", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  describe("#fetchFileHistory", () => {
    it("fetches the full history of the file", async () => {
      vagrantSshfsDotChanges.should.not.have.property("history");
      await fetchFileHistory(
        con,
        vagrantSshfsDotChanges
      ).should.be.fulfilled.and.eventually.deep.equal(
        vagrantSshfsDotChangesFileHistory
      );
      vagrantSshfsDotChanges.should.not.have.property("history");
    });

    it("fetches the history of the file at specific revisions", async () => {
      await fetchFileHistory(
        con,
        vagrantSshfsDotChanges,
        vagrantSshfsHistory.slice(0, 3)
      ).should.be.fulfilled.and.eventually.deep.equal(
        vagrantSshfsDotChangesFileHistory.slice(0, 3)
      );
    });
  });
});
