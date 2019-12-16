/**
 * Copyright (c) 2019 SUSE LLC
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
import * as nock from "nock";
import { Connection, normalizeUrl } from "../src/connection";
import { ApiError } from "../src/error";
import {
  afterEachRecorded,
  ApiType,
  beforeEachRecorded,
  getTestConnection
} from "./test-setup";

describe("normalizeUrl", () => {
  it("throws an exception when the url is invalid", () => {
    expect(() => {
      normalizeUrl("__asdf");
    }).to.throw(TypeError, /invalid url/i);
  });
});

describe("Connection", () => {
  it("rejects non https API urls", () => {
    expect(() => new Connection("foo", "bar", "http://api.baz.org")).to.throw(
      Error,
      /does not use https/
    );
  });

  describe("#makeApiCall", () => {
    beforeEach(beforeEachRecorded);

    afterEach(afterEachRecorded);

    it("throws an exception when the HTTP request fails", async () => {
      // invalid credentials => get a 401
      const wrongAuthConn = new Connection("suspicouslyFake", "evenFaker");
      await wrongAuthConn
        .makeApiCall("superInvalidRouteFromOuterSpace")
        .should.be.rejectedWith(ApiError, /failed to load url/i)
        .and.eventually.have.property("statusCode", 401);
    });

    it("decodes the status reply from OBS and throws an ApiError", async () => {
      const conn = getTestConnection(ApiType.Production);
      await conn
        .makeApiCall("source/blablabbliiii/_meta")
        .should.be.rejectedWith(ApiError)
        .and.eventually.deep.include({
          method: "GET",
          status: {
            code: "unknown_project",
            summary: "blablabbliiii"
          },
          statusCode: 404
        });
    });

    it("throws an exception the payload is not XML", async () => {
      const conn = new Connection(
        "don'tCare",
        "neitherHere",
        "https://jsonplaceholder.typicode.com"
      );
      await conn
        .makeApiCall("todos/1")
        .should.be.rejectedWith(Error, /char.*{/i);
    });

    it("throws an exception when the request fails", async () => {
      nock.back.setMode("lockdown");

      nock("https://expired.badssl.com")
        .get("/foo")
        .replyWithError("Error: certificate has expired");
      const conn = new Connection("fake", "fake", "https://expired.badssl.com");
      await conn
        .makeApiCall("foo")
        .should.be.rejectedWith(Error, /certificate has expired/);
    });

    it("does not parse the reply when decodeReply is false", async () => {
      const con = new Connection(
        "don'tCare",
        "neitherHere",
        "https://jsonplaceholder.typicode.com"
      );
      const todo = await con.makeApiCall("todos/1", { decodeReply: false })
        .should.be.fulfilled;
      expect(JSON.parse(todo)).to.deep.equal({
        userId: 1,
        id: 1,
        title: "delectus aut autem",
        completed: false
      });
    });
  });
});
