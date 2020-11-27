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

import { expect } from "chai";
import { describe, it } from "mocha";
import * as nock from "nock";
import { URL } from "url";
import { Account } from "../src/account";
import { Connection, normalizeUrl, RequestMethod } from "../src/connection";
import { ApiError, TimeoutError } from "../src/error";
import { TokenKind } from "../src/token";
import { range } from "../src/util";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection
} from "./test-setup";

const badSslComCertificate = `-----BEGIN CERTIFICATE-----
MIIDeTCCAmGgAwIBAgIJAPziuikCTox4MA0GCSqGSIb3DQEBCwUAMGIxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYwFAYDVQQHDA1TYW4gRnJhbmNp
c2NvMQ8wDQYDVQQKDAZCYWRTU0wxFTATBgNVBAMMDCouYmFkc3NsLmNvbTAeFw0x
OTEwMDkyMzQxNTJaFw0yMTEwMDgyMzQxNTJaMGIxCzAJBgNVBAYTAlVTMRMwEQYD
VQQIDApDYWxpZm9ybmlhMRYwFAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ8wDQYDVQQK
DAZCYWRTU0wxFTATBgNVBAMMDCouYmFkc3NsLmNvbTCCASIwDQYJKoZIhvcNAQEB
BQADggEPADCCAQoCggEBAMIE7PiM7gTCs9hQ1XBYzJMY61yoaEmwIrX5lZ6xKyx2
PmzAS2BMTOqytMAPgLaw+XLJhgL5XEFdEyt/ccRLvOmULlA3pmccYYz2QULFRtMW
hyefdOsKnRFSJiFzbIRMeVXk0WvoBj1IFVKtsyjbqv9u/2CVSndrOfEk0TG23U3A
xPxTuW1CrbV8/q71FdIzSOciccfCFHpsKOo3St/qbLVytH5aohbcabFXRNsKEqve
ww9HdFxBIuGa+RuT5q0iBikusbpJHAwnnqP7i/dAcgCskgjZjFeEU4EFy+b+a1SY
QCeFxxC7c3DvaRhBB0VVfPlkPz0sw6l865MaTIbRyoUCAwEAAaMyMDAwCQYDVR0T
BAIwADAjBgNVHREEHDAaggwqLmJhZHNzbC5jb22CCmJhZHNzbC5jb20wDQYJKoZI
hvcNAQELBQADggEBAGlwCdbPxflZfYOaukZGCaxYK6gpincX4Lla4Ui2WdeQxE95
w7fChXvP3YkE3UYUE7mupZ0eg4ZILr/A0e7JQDsgIu/SRTUE0domCKgPZ8v99k3A
vka4LpLK51jHJJK7EFgo3ca2nldd97GM0MU41xHFk8qaK1tWJkfrrfcGwDJ4GQPI
iLlm6i0yHq1Qg1RypAXJy5dTlRXlCLd8ufWhhiwW0W75Va5AEnJuqpQrKwl3KQVe
wGj67WWRgLfSr+4QG1mNvCZb2CkjZWmxkGPuoP40/y7Yu5OFqxP5tAjj4YixCYTW
EVA0pmzIzgBg+JIe3PdRy27T0asgQW/F4TY61Yk=
-----END CERTIFICATE-----
`;

describe("normalizeUrl", () => {
  it("throws an exception when the url is invalid", () => {
    expect(() => {
      normalizeUrl("__asdf");
    }).to.throw(TypeError, /invalid url/i);
  });
});

describe("Connection", () => {
  it("rejects non https API urls", () => {
    expect(
      () => new Connection("foo", "bar", { url: "http://api.baz.org" })
    ).to.throw(Error, /does not use https/);
    expect(
      () =>
        new Connection("foo", "bar", {
          url: "http://api.baz.org",
          forceHttps: true
        })
    ).to.throw(Error, /does not use https/);
  });

  it("permits non https API urls when explicitly allowed", () => {
    expect(
      () =>
        new Connection("foo", "bar", {
          url: "http://api.baz.org",
          forceHttps: false
        })
    ).to.not.throw();
  });

  it("rejects non-https and non-http urls when forceHttps is false", () => {
    expect(
      () =>
        new Connection("foo", "bar", {
          url: "ftp://api.baz.org",
          forceHttps: false
        })
    ).to.throw(Error, /doesn't use http or https/);
  });

  describe("#makeApiCall", () => {
    beforeEach(beforeEachRecordHook);

    afterEach(afterEachRecordHook);

    const todo1 = {
      userId: 1,
      id: 1,
      title: "delectus aut autem",
      completed: false
    };

    it("throws an exception when the HTTP request fails", async () => {
      // invalid credentials => get a 401
      const route = "superInvalidRouteFromOuterSpace";
      const wrongAuthCon = new Connection("suspicouslyFake", "evenFaker");
      const err = await wrongAuthCon
        .makeApiCall(route)
        .should.be.rejectedWith(ApiError, /failed to make a get request to/i);
      err.should.have.property("statusCode", 401);
      err.should.have
        .property("url")
        .that.deep.equals(new URL(`${wrongAuthCon.url}${route}`));
      // no status is received from the API as we got a authentication error
      err.should.have.property("status", undefined);
    });

    it("decodes the status reply from OBS and throws an ApiError", async () => {
      const proj = "blablabbliiii";
      const con = getTestConnection(ApiType.Production);
      await con
        .makeApiCall(`source/${proj}/_meta`)
        .should.be.rejectedWith(ApiError)
        .and.eventually.deep.include({
          method: "GET",
          status: {
            code: "unknown_project",
            summary: proj
          },
          statusCode: 404
        });
    });

    it("throws an exception the payload is not XML", async () => {
      const conn = new Connection("don'tCare", "neitherHere", {
        url: "https://jsonplaceholder.typicode.com"
      });
      await conn
        .makeApiCall("todos/1")
        .should.be.rejectedWith(Error, /char.*{/i);
    });

    it("does not parse the reply when decodeReply is false", async () => {
      const con = new Connection("don'tCare", "neitherHere", {
        url: "https://jsonplaceholder.typicode.com"
      });
      const todo = await con.makeApiCall("todos/1", {
        decodeResponseFromXml: false
      });
      expect(JSON.parse(todo.toString())).to.deep.equal(todo1);
    });

    it("can make requests to http urls as well", async () => {
      const con = new Connection("don'tCare", "neitherHere", {
        url: "http://jsonplaceholder.typicode.com",
        forceHttps: false
      });
      const todo = await con.makeApiCall("todos/1", {
        decodeResponseFromXml: false
      });
      expect(JSON.parse(todo.toString())).to.deep.equal(todo1);
    });

    it("stores cookies persistently in the Connection", async () => {
      const con = getTestConnection(ApiType.Production);
      const route = "/source/Virtualization:vagrant/";

      const virtVagrant = await con.makeApiCall(route);
      // OBS should reply with a openSUSE_session cookie and only that
      con.should.have
        .property("cookies")
        .that.is.an("array")
        .and.includes.a.thing.that.matches(/opensuse.*session/i);

      // we are now nasty and drop an internal field of the Connection object,
      // so the resulting Connection *must* use the session Cookie
      // tslint:disable-next-line: no-string-literal
      const oldHeaders = (con as any)["headers"];
      // tslint:disable-next-line: no-string-literal
      (con as any)["headers"] = "";

      await con.makeApiCall(route).should.eventually.deep.equal(virtVagrant);

      // now insert a faulty session cookie and ensure that we don't get an error
      // tslint:disable-next-line: no-string-literal
      (con as any)["cookies"] = [
        "openSUSE_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; path=/; Max-Age=86400; Secure; HttpOnly; domain=.opensuse.org"
      ];
      // of course we have to reinsert the old headers
      // tslint:disable-next-line: no-string-literal
      (con as any)["headers"] = oldHeaders;

      await con.makeApiCall(route).should.eventually.deep.equal(virtVagrant);
    });
  });

  describe("#makeApiCall live tests", () => {
    const selfSigned = "https://self-signed.badssl.com/";
    it("connects to a server with a custom certificate, when provided", async () => {
      const con = new Connection("don'tCare", "invalid", {
        url: selfSigned,
        serverCaCertificate: badSslComCertificate
      });

      await con.makeApiCall("/", {
        decodeResponseFromXml: false
      });
    });

    it("rejects connections to a server with a custom cert when no ca is provided", async () => {
      const con = new Connection("don'tCare", "invalid", {
        url: selfSigned
      });

      await con
        .makeApiCall("/", {
          decodeResponseFromXml: false
        })
        .should.be.rejectedWith(/self signed certificate/i);
    });

    it("throws an exception when the request fails", async () => {
      const con = new Connection("fake", "fake", {
        url: "https://expired.badssl.com"
      });
      await con
        .makeApiCall("foo")
        .should.be.rejectedWith(Error, /certificate has expired/);
    });
  });

  describe("#makeApiCall mocked", function () {
    this.timeout(10000);

    const url = "http://api.foo.org";
    const con = new Connection("foo", "fooPw", { url, forceHttps: false });

    before(() => nock.disableNetConnect());

    after(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it("rejects payloads that are not of type Buffer", async () => {
      await con
        .makeApiCall("/", { payload: "foo", sendPayloadAsRaw: true })
        .should.be.rejectedWith(Error, /payload.*is not a Buffer/);
    });

    it("reuses only the pathname and search parameters of a URL", async () => {
      const fooParam = "fooo";
      const barParam = "barrr";
      const success = "Success!";
      const baseRoute = "some/path";
      const scopes = nock(url)
        .get(`/${baseRoute}?foo=${fooParam}&bar=${barParam}`)
        .reply(200, success);

      const route = new URL(`http://name.xyz/${baseRoute}`);
      route.searchParams.append("foo", fooParam);
      route.searchParams.append("bar", barParam);

      await con
        .makeApiCall(route, { decodeResponseFromXml: false })
        .should.eventually.deep.equal(Buffer.from(success));

      scopes.isDone().should.equal(true);
    });

    describe("timeouts", () => {
      it("throws an exception when the request timed out", async () => {
        nock(url)
          .get("/")
          .delay(3000)
          .reply(200, "Will never receive this")
          .get("/")
          .delay(3000)
          .reply(200, "and neither this");

        await con
          .makeApiCall("/", { timeoutMs: 1, maxRetries: 1 })
          .should.be.rejectedWith(
            TimeoutError,
            /Could not make a GET request to.*api\.foo\.org.*retried unsuccessfully 1 time and took \d+ms in total./
          );

        nock.abortPendingRequests();
      });

      it("retries after receiving a 503", async () => {
        const reply = "good request";
        const scopes = nock(url)
          .get("/")
          .reply(503, "BAD REQUEST!!!")
          .get("/")
          .reply(200, reply);

        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(Buffer.from(reply));

        scopes.isDone().should.equal(true);
      });

      it("honors the Retry-After delay after receiving a 503", async () => {
        const retryAfterSec = 3;

        const reply = "good request";
        const scopes = nock(url)
          .get("/")
          .reply(503, "BAD REQUEST!!!", { "Retry-After": `${retryAfterSec}` })
          .get("/")
          .reply(200, reply);

        const beforeCall = new Date();
        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(Buffer.from(reply));
        const afterCall = new Date();

        expect(
          afterCall.getTime() - beforeCall.getTime() > retryAfterSec * 1000
        ).to.equal(true);
        scopes.isDone().should.equal(true);
      });

      it("honors the Retry-After date after receiving a 503", async () => {
        const reply = "good request";
        const beforeCall = new Date();
        const retryDate = new Date(beforeCall.getTime() + 4500);

        const scopes = nock(url)
          .get("/")
          .reply(503, "BAD REQUEST!!!", {
            "Retry-After": `${retryDate.toString()}`
          })
          .get("/")
          .reply(200, reply);

        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(Buffer.from(reply));
        const afterCall = new Date();

        // FIXME: somehow makeApiCall() finishes nearly a second earlier
        expect(afterCall.getTime() + 1000 >= retryDate.getTime()).to.equal(
          true
        );
        scopes.isDone().should.equal(true);
      });

      it("does not die when Retry-After has an invalid value", async () => {
        const reply = Buffer.from("good request");
        const scopes = nock(url)
          .get("/")
          .reply(503, "BAD REQUEST!!!", { "Retry-After": "asdf" })
          .get("/")
          .reply(200, reply);

        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(reply);

        scopes.isDone().should.equal(true);
      });

      it("does not retry POST requests", async () => {
        const scopes = nock(url)
          .post("/")
          .delay(3000)
          .reply(200, "Will never receive this");

        await con
          .makeApiCall("/", {
            method: RequestMethod.POST,
            decodeResponseFromXml: false,
            timeoutMs: 500,
            // this gets ignored:
            maxRetries: 100
          })
          .should.be.rejectedWith(
            TimeoutError,
            /Could not make a POST request.* took \d+ms in total./
          );

        scopes.isDone().should.equal(true);
      });
    });

    describe("redirects", () => {
      it("redirects when receiving a 301", async () => {
        const reply = Buffer.from("redirect worked!");

        const route = "/redirect";
        const newUrl = `${url}${route}`;
        nock(url)
          .get("/")
          .reply(301, "Will not care about the body", {
            Location: newUrl
          })
          .get(route)
          .reply(200, reply);

        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(reply);

        nock.isDone().should.equal(true);
      });

      it("retries the request when receiving a 301 but no Location header entry", async () => {
        const reply = Buffer.from("redirect did not work...");

        nock(url)
          .get("/")
          .reply(301, "Will not care about the body")
          .get("/")
          .reply(200, reply);

        await con
          .makeApiCall("/", { decodeResponseFromXml: false })
          .should.eventually.deep.equal(reply);

        nock.isDone().should.equal(true);
      });
    });

    describe("maxConcurrentConnections", () => {
      const reply = Buffer.from("this is a reply");
      const addDelayedResponse = (interceptor: nock.Scope) =>
        interceptor.get("/").delayBody(1500).reply(200, reply);

      it("does not issue more concurrent connections than maxConcurrentConnections", async () => {
        const beforeCall = new Date();

        addDelayedResponse(addDelayedResponse(addDelayedResponse(nock(url))));

        const limitedCon = con.clone({ maxConcurrentConnections: 2 });

        await Promise.all(
          range(3).map((_num) =>
            limitedCon
              .makeApiCall("/", { decodeResponseFromXml: false })
              .should.eventually.deep.equal(reply)
          )
        );

        const afterCall = new Date();
        expect(afterCall.getTime() - beforeCall.getTime()).to.be.least(3000);

        nock.isDone().should.equal(true);
      });

      it("does not limit the connection count if a negative number is set", async () => {
        const beforeCall = new Date();

        let scope = nock(url);
        for (let i = 0; i < 1000; i++) {
          scope = addDelayedResponse(scope);
        }

        const unlimitedCon = con.clone({ maxConcurrentConnections: -1 });

        await Promise.all(
          range(1000).map((_num) =>
            unlimitedCon
              .makeApiCall("/", { decodeResponseFromXml: false })
              .should.eventually.deep.equal(reply)
          )
        );

        const afterCall = new Date();
        expect(afterCall.getTime() - beforeCall.getTime()).to.be.within(
          1500,
          2500
        );

        nock.isDone().should.equal(true);
      });
    });
  });

  describe("#clone", () => {
    const con = new Connection("fake", "fakePw", {
      url: "https://build.opensuse.org"
    });
    const token = {
      userId: "fake",
      id: 42,
      string: "superSecretValue",
      kind: TokenKind.Rebuild
    };
    const tokenCon = new Connection(token);

    it("creates an exact copy if no parameters are provided", () => {
      const cloned = con.clone();
      const tokenCloned = tokenCon.clone();
      [
        "authSource",
        "authHeaders",
        "username",
        "headers",
        "serverCaCertificate",
        "url",
        "maxConcurrentConnections"
      ].forEach((key) =>
        [
          [cloned, con],
          [tokenCloned, tokenCon]
        ].forEach(([clone, orig]) =>
          expect((clone as any)[key]).to.deep.equal((orig as any)[key])
        )
      );
    });

    it("uses the new parameters if supplied", () => {
      const username = "fake2";
      const urlStr = "https://api-test.opensuse.org/";
      const serverCaCertificate = "looks legit";
      const newParams = {
        username,
        url: urlStr,
        serverCaCertificate
      };

      expect(con.clone(newParams)).to.deep.include({
        username,
        serverCaCertificate,
        url: new URL(urlStr),
        authSource: { username: newParams.username, password: "fakePw" }
      });
    });

    it("rejects new invalid parameters", () => {
      expect(() => con.clone({ url: "" })).to.throw(TypeError, /invalid url/i);
    });

    it("rejects overriding the username if the Connection has been created from a Token", () => {
      expect(() => tokenCon.clone({ username: "newUsername" })).to.throw(
        Error,
        /cannot clone/
      );
    });

    it("clones a Connection and uses a new Token", () => {
      const { id, kind, userId } = token;
      const string = "otherSuperSecret";
      const maxConcurrentConnections = 80;
      const newToken = { id, kind, userId, string };
      tokenCon
        .clone({ token: newToken, maxConcurrentConnections })
        .should.deep.include({
          username: userId,
          authSource: newToken,
          maxConcurrentConnections
        });
    });

    it("clones a username based Connection to use a token instead", () => {
      const forceHttps = false;
      con.clone({ token: token, forceHttps }).should.deep.include({
        authSource: token,
        forceHttps,
        username: token.userId
      });
    });
  });

  describe("#from", () => {
    it("converts an account with a password to a connection", () => {
      const opts = {
        username: "foo",
        password: "bar",
        apiUrl: normalizeUrl("https://api.foo.org")
      };
      const con = Connection.from(new Account(opts));
      con.username.should.deep.equal(opts.username);
      con.url.should.deep.equal(new URL(opts.apiUrl));
    });

    it("throws an error if the account has no password set", () => {
      expect(() =>
        Connection.from(
          new Account({
            username: "foo",
            apiUrl: "https://api.foo.org",
            password: undefined
          })
        )
      ).to.throw(Error, /password is not set/i);
    });

    it("forwards the options to the constructor of Connection", () => {
      const opts = {
        username: "foo",
        password: "bar",
        apiUrl: normalizeUrl("http://api.foo.org")
      };

      Connection.from(new Account(opts), {
        forceHttps: false
      }).url.should.deep.equal(new URL(opts.apiUrl));

      expect(() => Connection.from(new Account(opts))).to.throw(
        Error,
        /does not use https/i
      );
    });
  });
});
