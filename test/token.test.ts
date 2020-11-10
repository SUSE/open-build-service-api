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

import * as nock from "nock";
import { Connection } from "../src/connection";
import { fetchTokens, TokenKind } from "../src/token";

describe("Token", () => {
  const url = "http://foo.bar.xyz";
  const userId = "fooUser";
  const con = new Connection(userId, "fooPw", { url, forceHttps: false });

  it("fetches a RSS token", async () => {
    const id = 16;
    const string = "superSecretValue";
    nock(url).get(`/person/${userId}/token`).reply(
      200,
      `<directory count="1">
  <entry id="${id}" string="${string}" kind="rss"/>
</directory>
`
    );
    await fetchTokens(con, "fooUser").should.eventually.deep.equal([
      { id, userId, kind: TokenKind.RSS, string }
    ]);
  });
});
