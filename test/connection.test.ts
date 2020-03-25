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
import { Connection, normalizeUrl } from "../src/connection";
import { ApiError } from "../src/error";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./test-setup";

const caCertRootCertificate = `-----BEGIN CERTIFICATE-----
MIIG7jCCBNagAwIBAgIBDzANBgkqhkiG9w0BAQsFADB5MRAwDgYDVQQKEwdSb290
IENBMR4wHAYDVQQLExVodHRwOi8vd3d3LmNhY2VydC5vcmcxIjAgBgNVBAMTGUNB
IENlcnQgU2lnbmluZyBBdXRob3JpdHkxITAfBgkqhkiG9w0BCQEWEnN1cHBvcnRA
Y2FjZXJ0Lm9yZzAeFw0wMzAzMzAxMjI5NDlaFw0zMzAzMjkxMjI5NDlaMHkxEDAO
BgNVBAoTB1Jvb3QgQ0ExHjAcBgNVBAsTFWh0dHA6Ly93d3cuY2FjZXJ0Lm9yZzEi
MCAGA1UEAxMZQ0EgQ2VydCBTaWduaW5nIEF1dGhvcml0eTEhMB8GCSqGSIb3DQEJ
ARYSc3VwcG9ydEBjYWNlcnQub3JnMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIIC
CgKCAgEAziLA4kZ97DYoB1CW8qAzQIxL8TtmPzHlawI229Z89vGIj053NgVBlfkJ
8BLPRoZzYLdufujAWGSuzbCtRRcMY/pnCujW0r8+55jE8Ez64AO7NV1sId6eINm6
zWYyN3L69wj1x81YyY7nDl7qPv4coRQKFWyGhFtkZip6qUtTefWIonvuLwphK42y
fk1WpRPs6tqSnqxEQR5YYGUFZvjARL3LlPdCfgv3ZWiYUQXw8wWRBB0bF4LsyFe7
w2t6iPGwcswlWyCR7BYCEo8y6RcYSNDHBS4CMEK4JZwFaz+qOqfrU0j36NK2B5jc
G8Y0f3/JHIJ6BVgrCFvzOKKrF11myZjXnhCLotLddJr3cQxyYN/Nb5gznZY0dj4k
epKwDpUeb+agRThHqtdB7Uq3EvbXG4OKDy7YCbZZ16oE/9KTfWgu3YtLq1i6L43q
laegw1SJpfvbi1EinbLDvhG+LJGGi5Z4rSDTii8aP8bQUWWHIbEZAWV/RRyH9XzQ
QUxPKZgh/TMfdQwEUfoZd9vUFBzugcMd9Zi3aQaRIt0AUMyBMawSB3s42mhb5ivU
fslfrejrckzzAeVLIL+aplfKkQABi6F1ITe1Yw1nPkZPcCBnzsXWWdsC4PDSy826
YreQQejdIOQpvGQpQsgi3Hia/0PsmBsJUUtaWsJx8cTLc6nloQsCAwEAAaOCAX8w
ggF7MB0GA1UdDgQWBBQWtTIb1Mfz4OaO873SsDrusjkY0TAPBgNVHRMBAf8EBTAD
AQH/MDQGCWCGSAGG+EIBCAQnFiVodHRwOi8vd3d3LmNhY2VydC5vcmcvaW5kZXgu
cGhwP2lkPTEwMFYGCWCGSAGG+EIBDQRJFkdUbyBnZXQgeW91ciBvd24gY2VydGlm
aWNhdGUgZm9yIEZSRUUgaGVhZCBvdmVyIHRvIGh0dHA6Ly93d3cuY2FjZXJ0Lm9y
ZzAxBgNVHR8EKjAoMCagJKAihiBodHRwOi8vY3JsLmNhY2VydC5vcmcvcmV2b2tl
LmNybDAzBglghkgBhvhCAQQEJhYkVVJJOmh0dHA6Ly9jcmwuY2FjZXJ0Lm9yZy9y
ZXZva2UuY3JsMDIGCCsGAQUFBwEBBCYwJDAiBggrBgEFBQcwAYYWaHR0cDovL29j
c3AuY2FjZXJ0Lm9yZzAfBgNVHSMEGDAWgBQWtTIb1Mfz4OaO873SsDrusjkY0TAN
BgkqhkiG9w0BAQsFAAOCAgEAR5zXs6IX01JTt7Rq3b+bNRUhbO9vGBMggczo7R0q
Ih1kdhS6WzcrDoO6PkpuRg0L3qM7YQB6pw2V+ubzF7xl4C0HWltfzPTbzAHdJtja
JQw7QaBlmAYpN2CLB6Jeg8q/1Xpgdw/+IP1GRwdg7xUpReUA482l4MH1kf0W0ad9
4SuIfNWQHcdLApmno/SUh1bpZyeWrMnlhkGNDKMxCCQXQ360TwFHc8dfEAaq5ry6
cZzm1oetrkSviE2qofxvv1VFiQ+9TX3/zkECCsUB/EjPM0lxFBmu9T5Ih+Eqns9i
vmrEIQDv9tNyJHuLsDNqbUBal7OoiPZnXk9LH+qb+pLf1ofv5noy5vX2a5OKebHe
+0Ex/A7e+G/HuOjVNqhZ9j5Nispfq9zNyOHGWD8ofj8DHwB50L1Xh5H+EbIoga/h
JCQnRtxWkHP699T1JpLFYwapgplivF4TFv4fqp0nHTKC1x9gGrIgvuYJl1txIKmx
XdfJzgscMzqpabhtHOMXOiwQBpWzyJkofF/w55e0LttZDBkEsilV/vW0CJsPs3eN
aQF+iMWscGOkgLFlWsAS3HwyiYLNJo26aqyWPaIdc8E4ck7Sk08WrFrHIK3EHr4n
1FZwmLpFAvucKqgl0hr+2jypyh5puA3KksHF3CsUzjMUvzxMhykh9zrMxQAHLBVr
Gwc=
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
    expect(() => new Connection("foo", "bar", "http://api.baz.org")).to.throw(
      Error,
      /does not use https/
    );
  });

  describe("#makeApiCall", () => {
    beforeEach(beforeEachRecord);

    afterEach(afterEachRecord);

    it("throws an exception when the HTTP request fails", async () => {
      // invalid credentials => get a 401
      const wrongAuthConn = new Connection("suspicouslyFake", "evenFaker");
      await wrongAuthConn
        .makeApiCall("superInvalidRouteFromOuterSpace")
        .should.be.rejectedWith(ApiError, /failed to load url/i)
        .and.eventually.have.property("statusCode", 401);
    });

    it("decodes the status reply from OBS and throws an ApiError", async () => {
      const con = getTestConnection(ApiType.Production);
      await con
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

    it("does not parse the reply when decodeReply is false", async () => {
      const con = new Connection(
        "don'tCare",
        "neitherHere",
        "https://jsonplaceholder.typicode.com"
      );
      const todo = await con.makeApiCall("todos/1", {
        decodeResponseFromXml: false
      }).should.be.fulfilled;
      expect(JSON.parse(todo)).to.deep.equal({
        userId: 1,
        id: 1,
        title: "delectus aut autem",
        completed: false
      });
    });

    it("stores cookies persistently in the Connection", async () => {
      const con = getTestConnection(ApiType.Production);
      const route = "/source/Virtualization:vagrant/";

      const virtVagrant = await con.makeApiCall(route).should.be.fulfilled;
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

      await con
        .makeApiCall(route)
        .should.be.fulfilled.and.eventually.deep.equal(virtVagrant);

      // now insert a faulty session cookie and ensure that we don't get an error
      // tslint:disable-next-line: no-string-literal
      (con as any)["cookies"] = [
        "openSUSE_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; path=/; Max-Age=86400; Secure; HttpOnly; domain=.opensuse.org"
      ];
      // of course we have to reinsert the old headers
      // tslint:disable-next-line: no-string-literal
      (con as any)["headers"] = oldHeaders;

      await con
        .makeApiCall(route)
        .should.be.fulfilled.and.eventually.deep.equal(virtVagrant);
    });
  });

  describe("#makeApiCall live tests", () => {
    it("connects to a server with a custom certificate, when provided", async () => {
      const con = new Connection(
        "don'tCare",
        "invalid",
        "https://www.cacert.org/",
        caCertRootCertificate
      );

      await con.makeApiCall("/index.php", {
        decodeResponseFromXml: false
      }).should.be.fulfilled;
    });

    it("rejects connections to a server with a custom cert when no ca is provided", async () => {
      const con = new Connection(
        "don'tCare",
        "invalid",
        "https://www.cacert.org/"
      );

      await con
        .makeApiCall("/index.php", {
          decodeResponseFromXml: false
        })
        .should.be.rejectedWith("self signed certificate in certificate chain");
    });

    it("throws an exception when the request fails", async () => {
      const con = new Connection("fake", "fake", "https://expired.badssl.com");
      await con
        .makeApiCall("foo")
        .should.be.rejectedWith(Error, /certificate has expired/);
    });
  });

  describe("#clone", () => {
    const con = new Connection("fake", "fakePw", "https://build.opensuse.org");

    it("creates an exact copy if no parameters are provided", () => {
      expect(con.clone()).to.deep.equal(con);
    });

    it("uses the new parameters if supplied", () => {
      const newParams = {
        username: "fake2",
        url: "https://api-test.opensuse.org/",
        serverCaCertificate: "looks legit"
      };
      expect(con.clone(newParams)).to.deep.include({
        ...newParams,
        password: "fakePw"
      });
    });

    it("rejects new invalid parameters", () => {
      expect(() => con.clone({ url: "" })).to.throw(TypeError, /invalid url/i);
    });
  });
});
