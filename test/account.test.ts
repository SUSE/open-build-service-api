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

import mock = require("mock-fs");

import { expect } from "chai";
import { promises as fsPromises } from "fs";
import { describe, it } from "mocha";
import { homedir } from "os";
import {
  Account,
  addAccountToOscrc,
  readAccountsFromOscrc
} from "../src/account";
import "./test-setup";

describe("Account", () => {
  beforeEach(() => {
    const options: any = {
      ".oscrc": `
[general]

[https://api.opensuse.org]
user = fooUser
keyring = 1
pass = fakePw
aliases = obs
realname = Foo Bar
email = foo@bar.com

[https://api.suse.de]
user = bazUser
pass = guess

[https://api-test.opensuse.org]
user = barUser
pass = secondFakePw
realname = Foo Baz
email = foo@baz.com
aliases = api,api_test
`,
      ".oscrc_empty": "",
      ".oscrc_no_api_sections": `
[general]
foo = bar
`
    };
    options[`${homedir()}/.config/osc/oscrc`] = `
[general]
[http://api.obs.fake]
user = me
pass = you
`;
    mock(options);
  });

  afterEach(() => mock.restore());

  describe("read accounts", () => {
    it("parses a valid .oscrc correctly", async () => {
      const accounts = await readAccountsFromOscrc(".oscrc").should.be
        .fulfilled;

      expect(accounts)
        .to.be.a("array")
        .and.have.length(3);

      expect(accounts).to.include.something.that.deep.equals({
        aliases: ["obs"],
        apiUrl: "https://api.opensuse.org/",
        email: "foo@bar.com",
        password: "fakePw",
        realname: "Foo Bar",
        username: "fooUser"
      });
      expect(accounts).to.include.something.that.deep.equals({
        aliases: ["api", "api_test"],
        apiUrl: "https://api-test.opensuse.org/",
        email: "foo@baz.com",
        password: "secondFakePw",
        realname: "Foo Baz",
        username: "barUser"
      });
      expect(accounts).to.include.something.that.deep.equals({
        aliases: [],
        apiUrl: "https://api.suse.de/",
        email: undefined,
        password: "guess",
        realname: undefined,
        username: "bazUser"
      });
    });

    it("parses an empty .oscrc correctly", async () => {
      const accounts = await readAccountsFromOscrc(".oscrc_empty");
      expect(accounts).to.eql([]);
    });

    it("parses an .oscrc without accounts sections correctly", async () => {
      const accounts = await readAccountsFromOscrc(".oscrc_no_api_sections");
      expect(accounts).to.eql([]);
    });

    it("returns an empty array on a non existent oscrc", async () => {
      const accounts = await readAccountsFromOscrc(
        "I_hope_you_dont_have_this_file_on_your_fs_asdfqwerty"
      );
      expect(accounts).to.eql([]);
    });

    it("uses $HOME/.config/osc/oscrc by default", async () => {
      const accounts = await readAccountsFromOscrc().should.be.fulfilled;
      expect(accounts)
        .to.be.a("array")
        .and.to.have.length(1);
      expect(accounts[0]).to.deep.equals({
        aliases: [],
        apiUrl: "http://api.obs.fake/",
        email: undefined,
        password: "you",
        realname: undefined,
        username: "me"
      });
    });
  });

  describe("write accounts", () => {
    const account = new Account({
      aliases: ["api", "api_test"],
      apiUrl: "https://api-test.opensuse.org",
      email: "foo@baz.com",
      password: "secondFakePw",
      realname: "Foo Baz",
      username: "barUser"
    });

    it("appends the new account to an existing oscrc", async () => {
      const acc = new Account({
        aliases: [],
        apiUrl: "https://api-test.opensuse.org",
        password: "secondFakePw",
        username: "barUser"
      });
      await addAccountToOscrc(acc);

      const newOscrc = await fsPromises.readFile(
        `${homedir()}/.config/osc/oscrc`
      );
      expect(newOscrc.toString()).to.eql(`
[general]
[http://api.obs.fake]
user = me
pass = you
[https://api-test.opensuse.org/]
user = barUser
`);
    });

    it("creates a new oscrc when no content is present", async () => {
      await addAccountToOscrc(account, ".oscrc_empty");

      const newOscrc = await fsPromises.readFile(".oscrc_empty");
      expect(newOscrc.toString()).to.eql(`
[general]
[https://api-test.opensuse.org/]
user = barUser
email = foo@baz.com
realname = Foo Baz
aliases = api,api_test
`);
    });

    it("throws an exception when the account is already present", async () => {
      await addAccountToOscrc(account, ".oscrc").should.be.rejectedWith(
        "Cannot add https://api-test.opensuse.org/ to oscrc: already present"
      );
    });
  });
});
