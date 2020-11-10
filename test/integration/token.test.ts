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
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook
} from "../test-setup";
import {
  TokenKind,
  createToken,
  fetchTokens,
  deleteToken,
  TokenOperation
} from "../../src/token";
import { expect } from "chai";
import { createPackage, deletePackage } from "../../src/package";

describe("Token", function () {
  this.timeout(5000);

  const con = getTestConnection(ApiType.MiniObs);

  before(skipIfNoMiniObsHook);

  describe("#fetchTokens", () => {
    beforeEach(beforeEachRecordHook);
    afterEach(afterEachRecordHook);

    it("fetches the empty token list correctly", async () => {
      await fetchTokens(con, miniObsUsername).should.eventually.deep.equal([]);
    });
  });

  describe("#createToken", () => {
    const testPkg = {
      name: "test_package",
      projectName: `home:${miniObsUsername}`
    };

    before(() => createPackage(con, testPkg.projectName, testPkg.name));

    after(() => deletePackage(con, testPkg.projectName, testPkg.name));

    afterEach(
      async (): Promise<void[]> =>
        Promise.all(
          (await fetchTokens(con, miniObsUsername)).map((tk) =>
            deleteToken(con, tk)
          )
        )
    );

    it("creates a runservice token by default", async () => {
      const token = await createToken(con, { id: miniObsUsername });

      token.should.have.property("id").that.is.a("number");
      token.should.have.property("string").that.is.a("string");
      token.should.deep.include({
        kind: TokenKind.RunService,
        userId: miniObsUsername
      });
    });

    it("creates a new token that can be read back in", async () => {
      const token = await createToken(con, miniObsUsername);

      const tokens = await fetchTokens(con, miniObsUsername);
      expect(tokens).to.have.length(1);
      tokens[0].should.deep.equal(token);
    });

    it("creates a token tied to a package", async () => {
      const token = await createToken(con, miniObsUsername, {
        package: testPkg
      });

      token.should.deep.include({
        kind: TokenKind.RunService,
        package: testPkg,
        userId: miniObsUsername
      });
    });

    it("creates a token for rebuilds", async () => {
      await createToken(con, miniObsUsername, {
        operation: TokenOperation.Rebuild
      })
        .should.eventually.have.property("kind")
        .that.equals(TokenKind.Rebuild);
    });

    it("creates a token for releases that is also bound to a specific package", async () => {
      const token = await createToken(con, miniObsUsername, {
        package: testPkg,
        operation: TokenOperation.Release
      });

      token.should.deep.include({
        kind: TokenKind.Release,
        package: testPkg,
        userId: miniObsUsername
      });
    });
  });

  describe("#deleteToken", () => {
    it("deletes a newly created token", async () => {
      const tokens = await Promise.all(
        [1, 2].map((_i) => createToken(con, miniObsUsername))
      );
      await deleteToken(con, tokens[0]);

      const tokensAfterDelete = await fetchTokens(con, miniObsUsername);
      expect(tokensAfterDelete).to.have.length(1);
      tokensAfterDelete[0].should.deep.equal(tokens[1]);

      await deleteToken(con, miniObsUsername, tokens[1].id);
      await fetchTokens(con, miniObsUsername).should.eventually.have.length(0);
    });
  });
});
