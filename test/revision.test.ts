import { describe, it } from "mocha";
import { Connection } from "../src/connection";
import { fetchRevisions } from "./../src/revision";

describe("Revision", () => {
  const con = new Connection("irrelevant", "password", "https://api.baz.xyz");

  describe("#fetchRevisions", () => {
    it("throws when the Project's apiUrl doesn't match the one of the Connection", async () => {
      await fetchRevisions(
        con,
        { apiUrl: "https://foo.bar.baz/", name: "irrelevant" },
        { name: "barPkg", project: "irrelevant" }
      ).should.be.rejectedWith(/api url (.*) does not match/i);
    });
  });
});
