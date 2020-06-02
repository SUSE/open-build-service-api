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

import * as assert from "assert";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { ApiError } from "./error";
import { newXmlBuilder, newXmlParser } from "./xml";

/**
 * Converts a url into a well defined format (e.g. whether `/` should be
 * appended).
 *
 * @param url  The url to be normalized. An exception is thrown if this is not a
 *     valid url.
 *
 * @throw `TypeError` when the parameter `url` is not valid.
 */
export function normalizeUrl(url: string): string {
  return new URL(url).toString();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RetryInfo {
  /**
   * Status that caused the need to retry the request.
   *
   * This is either a HTTP status code:
   * - 503 & 429 indicate that the server or resource is temporarily unavailable
   *   and 301 indicates a redirect
   * or
   * - "timeout": indicates that the request timed out
   */
  readonly status: 503 | 429 | 301 | "timeout";

  /**
   * If the RetryInfo was created from a [[IncomingMessage]] with the
   * `Retry-After` HTTP Header set and the [[statusCode]] was 429 or 503, then
   * this field contains the required number of milliseconds that have to be
   * waited.
   */
  readonly retryAfterMs?: number;

  /**
   * If the RetryInfo was created from a [[IncomingMessage]] with the `Location`
   * HTTP header set and it was a redirect, then this field contains the URL to
   * which we are being redirected.
   */
  readonly location?: URL;
}

function isRetryInfo(obj: any): obj is RetryInfo {
  return (
    obj.status !== undefined &&
    (obj.status === 503 ||
      obj.status === 429 ||
      obj.status === 301 ||
      obj.status === "timeout")
  );
}

function retryInfoOnTimeout(retryAfterMs?: number): RetryInfo {
  return { status: "timeout", retryAfterMs };
}

function retryInfoFromIncommingMessage(
  response: http.IncomingMessage
): RetryInfo | undefined {
  if (
    response.statusCode !== 503 &&
    response.statusCode !== 429 &&
    response.statusCode !== 301
  ) {
    return undefined;
  }

  let retryAfterMs: number | undefined;
  let location: URL | undefined;
  if (response.statusCode === 503 || response.statusCode === 429) {
    if (response.headers["retry-after"] !== undefined) {
      retryAfterMs = 1000 * parseInt(response.headers["retry-after"], 10);
      if (isNaN(retryAfterMs)) {
        const retryAfterDate = new Date(response.headers["retry-after"]);
        retryAfterMs = retryAfterDate.getTime() - new Date().getTime();
      }
    }
  } else if (
    response.statusCode === 301 &&
    response.headers.location !== undefined
  ) {
    try {
      location = new URL(response.headers.location);
    } catch (_err) {
      // NOP
    }
  }

  return {
    status: response.statusCode,
    retryAfterMs:
      retryAfterMs === undefined || isNaN(retryAfterMs)
        ? undefined
        : retryAfterMs,
    location
  };
}

/**
 * The supported request methods by [[Connection.makeApiCall]].
 */
export const enum RequestMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE"
}

export interface ApiCallMainOptions {
  /**
   * The method used to perform the request. Defaults to
   * [[GET|RequestMethod.GET]].
   */
  method?: RequestMethod;

  /**
   * An arbitrary object to be sent along with the request.
   *
   * This object is encoded to XML via the builder obtained from
   * [[newXmlBuilder]].
   */
  payload?: any;

  /**
   * Whether `payload` should be sent as it is. If false (or omitted), then
   * `payload` is expected to be an object that is encoded to XML via the
   * builder obtained via [[newXmlBuilder]]
   */
  sendPayloadAsRaw?: boolean;

  /**
   * Timeout for a single HTTP request in milliseconds. Defaults to 1000.
   */
  timeoutMs?: number;

  /**
   * How many times will a request be retried before throwing an Error. Defaults
   * to 10.
   */
  maxRetries?: number;
}

export interface ApiCallOptions extends ApiCallMainOptions {
  /**
   * Whether the response is assumed to be XML and decoded into a JS object
   * using the parser obtained from [[newXmlParser]].
   *
   * The response is by default assumed to be XML.
   */
  decodeResponseFromXml?: boolean;
}

type ApiCallInternalOptions = ApiCallOptions & { timeoutMs: number };

/**
 * Class for storing the credentials to connect to an Open Build Service
 * instance.
 *
 * It stores cookies persistently between requests, so that instances of the
 * Open Build Service that send session cookies can use these and don't have to
 * issue a new session per request.
 */
export class Connection {
  /** the username which will be used to connect to the API */
  public readonly username: string;

  /** URL to the API of this buildservice instance */
  public readonly url: string;

  /** the user's password */
  private readonly password: string;

  /** HTTP simple auth header containing the necessary credentials */
  private readonly headers: string;

  private cookies: string[] = [];

  private readonly serverCaCertificate?: string;

  private readonly request: typeof http.request | typeof https.request;

  /**
   * Construct a connection using the provided username and password
   * @param username  username used for authentication
   * @param password  password of the user
   * @param options  Additional options for the new Connection:
   *     - `url`: URL to the API, it **must** use `https` unless `forceHttps` is
   *       set to false.
   *       `https://api.opensuse.org/` is used if unspecified.
   *       CAUTION: this is **not** the URL to the webpage of the buildservice
   *       instance (usually you have to swap the initial `build.` to `api.`).
   *     - `serverCaCertificate` A custom root certificate in the PEM format
   *       that should be used to connect to the API.
   *       If not provided, nodejs will by default use its certificate chain,
   *       which may or may not include the system certificates. Thus
   *       connections to servers with certificates signed by custom CAs *can*
   *       fail.
   *     - `forceHttps`: If set to `false`, then the constructor will accept
   *        http urls as well. Other protocols are rejected.
   *
   * @throw Error when the url is invalid or when it does not use https (and
   *     `forceHttps` is true or undefined).
   */
  constructor(
    username: string,
    password: string,
    options: {
      url?: string;
      serverCaCertificate?: string;
      forceHttps?: boolean;
    } = {}
  ) {
    this.password = password;
    this.username = username;

    this.headers = `${this.username}:${this.password}`;
    this.serverCaCertificate = options.serverCaCertificate;

    this.url = normalizeUrl(options.url ?? "https://api.opensuse.org");

    const protocol = new URL(this.url).protocol;
    if (options.forceHttps === undefined || options.forceHttps) {
      if (protocol !== "https:") {
        throw new Error(
          `${this.url} does not use https, got ${protocol} instead`
        );
      }
    } else {
      if (protocol !== "https:" && protocol !== "http:") {
        throw new Error(
          `${this.url} doesn't use http or https, got ${protocol} instead`
        );
      }
    }
    this.request = protocol === "https:" ? https.request : http.request;
  }

  /**
   * Create a copy of the current Connection preserving its password with
   * optional new settings.
   *
   * If some of the parameters are not provided, then the current values are
   * used. Note that the cookies are **not** cloned into the new Connection!
   *
   * @param username  An optional new username.
   * @param url  An optional new URL to the API.
   * @param serverCaCertificate  An optional new server certificate.
   * @param forceHttps  Whether to enforce https or permit http as well (defaults
   *     to `true` = enforce https).
   *
   * @return A new Connection that has the same password as the current
   *     Connection object.
   *
   * @throw Same errors as the constructor.
   */
  public clone({
    username,
    url,
    serverCaCertificate,
    forceHttps
  }: {
    username?: string;
    url?: string;
    serverCaCertificate?: string;
    forceHttps?: boolean;
  } = {}): Connection {
    return new Connection(username ?? this.username, this.password, {
      url: url ?? this.url,
      serverCaCertificate: serverCaCertificate ?? this.serverCaCertificate,
      forceHttps
    });
  }

  /**
   * Perform a request to the API and convert replies' body from XML into a JS
   * object.
   *
   * @return The body of the reply, decoded from XML via xml2js'
   *     [parseString](https://github.com/Leonidas-from-XIV/node-xml2js#usage).
   *     The reply is only decoded when the request succeeds.
   */
  public async makeApiCall(
    route: string,
    options?: ApiCallMainOptions & { decodeResponseFromXml?: true }
  ): Promise<any>;

  /**
   * Perform a request to the API and return the retrieved data itself as a
   * Buffer.
   *
   * @return The raw reply as a `Buffer`.
   */
  public async makeApiCall(
    route: string,
    options?: ApiCallMainOptions & { decodeResponseFromXml: false }
  ): Promise<Buffer>;

  /**
   * Perform a request to the API and return the replies' body (by default
   * decoded from XML).
   *
   * The request is retried if it times out or if one of the following status
   * codes is received: `301`, `429` or `503`. At most [[options.maxRetries]]
   * retries are issued with a sleep between them that is doubled on each retry.
   *
   * @param route  route to which the request will be sent
   * @param options  Additional options for further control. By default the
   *     request is a [[GET|RequestMethod.GET]] request with no payload and the
   *     response is assumed to be XML.
   *
   * @throw
   *     - [[ApiError]] if the API replied with a status code less than
   *       `200` or more than `299`.
   *     - `Error` when no successful request was made after
   *       [[options.maxRetries]] requests.
   */
  public async makeApiCall(
    route: string,
    options?: ApiCallOptions
  ): Promise<any> {
    let url = new URL(route, this.url);
    const reqMethod =
      options?.method === undefined ? RequestMethod.GET : options.method;
    assert(
      reqMethod !== undefined,
      "request method in reqMethod must not be undefined"
    );

    const opts = options !== undefined ? { ...options } : { timeoutMs: 1000 };
    if (opts.timeoutMs === undefined) {
      opts.timeoutMs = 1000;
    }
    assert(opts.timeoutMs !== undefined);

    const maxRetries = options?.maxRetries ?? 10;
    let waitBetweenCallsMs = 1000;

    for (let i = 0; i < maxRetries; i++) {
      const res = await this.doMakeApiCall(
        url,
        reqMethod,
        // FIXME: how can we convince typescript that timeoutMs is actually
        // never undefined?
        opts as ApiCallInternalOptions
      );
      if (!isRetryInfo(res)) {
        return res;
      }
      if (res.location !== undefined) {
        url = res.location;
      } else if (res.status === "timeout") {
        opts.timeoutMs = 2 * opts.timeoutMs;
      }

      if (
        res.retryAfterMs !== undefined ||
        res.status === 503 ||
        res.status === 429
      ) {
        await sleep(res.retryAfterMs ?? waitBetweenCallsMs);
      } else {
        await sleep(waitBetweenCallsMs);
      }
      waitBetweenCallsMs *= 2;
    }

    throw new Error(
      `Could not make a ${reqMethod} request to ${url.toString()}, tried unsuccessfully ${maxRetries} times.`
    );
  }

  private doMakeApiCall(
    url: URL,
    reqMethod: RequestMethod,
    options: ApiCallInternalOptions
  ): Promise<any | RetryInfo> {
    return new Promise((resolve, reject) => {
      const req = this.request(
        url,
        {
          auth: this.headers,
          ca: this.serverCaCertificate,
          headers: { cookie: this.cookies },
          method: reqMethod,
          timeout: options.timeoutMs
        },
        (response) => {
          const body: any[] = [];

          response.on("data", (chunk) => {
            body.push(chunk);
          });

          response.on("error", (err) => {
            reject(err);
          });

          // handle errors in the request here, because the API returns more
          // detailed error messages in the body, but the body is not available
          // until the "end" event occurs
          response.on("end", () => {
            const cookies = response.headers["set-cookie"];
            if (cookies !== undefined) {
              this.cookies = cookies;
            }

            const finish = (err: Error | null, payload: any): void => {
              if (err) {
                reject(err);
              }

              const retry = retryInfoFromIncommingMessage(response);
              if (retry !== undefined) {
                resolve(retry);
              }

              if (response.statusCode! < 200 || response.statusCode! > 299) {
                reject(
                  new ApiError(response.statusCode!, url, reqMethod, payload)
                );
              }
              resolve(payload);
            };

            if (
              options?.decodeResponseFromXml !== undefined &&
              !options.decodeResponseFromXml
            ) {
              finish(null, Buffer.concat(body));
            } else {
              newXmlParser().parseString(body.join(""), finish);
            }
          });
        }
      );

      req.on("timeout", () => {
        req.abort();
        resolve(retryInfoOnTimeout(options?.timeoutMs));
      });

      req.on("error", (err) => reject(err));

      if (options?.payload !== undefined) {
        const payload =
          options.sendPayloadAsRaw === undefined || !options.sendPayloadAsRaw
            ? Buffer.from(newXmlBuilder().buildObject(options.payload))
            : options.payload;
        // obs expects that if it receives data, that the content type is
        // 'application/octet-stream'
        req.setHeader("Content-Type", "application/octet-stream");
        // It is absolutely crucial to set the content-length header field!
        // Otherwise node will use chunked transfers and OBS chokes on these (at
        // least when using http connections).
        // See also: https://github.com/openSUSE/open-build-service/issues/9329
        req.setHeader("Content-Length", payload.length);
        req.write(payload);
      }
      req.end();
    });
  }
}
