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

import * as assert from "assert";
import { request } from "https";
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

/**
 * The supported request methods by [[Connection.makeApiCall]].
 */
export const enum RequestMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE"
}

/**
 * Class for storing the credentials to connect to a Open Build Service instance.
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

  /**
   * Construct a connection using the provided username and password
   * @param username  username used for authentication
   * @param password  password of the user
   * @param url URL to the API, **must** use `https`.
   *     CAUTION: this is **not** the URL to the webpage of the buildservice
   *     instance (usually you have to swap the initial `build.` to `api.`).
   *
   * @throw Error when the url is invalid or when it does not use https.
   */
  constructor(
    username: string,
    password: string,
    url: string = "https://api.opensuse.org"
  ) {
    this.password = password!;
    this.username = username!;

    this.headers = `${this.username}:${this.password}`;
    this.url = normalizeUrl(url);

    const protocol = new URL(this.url).protocol;
    if (protocol !== "https:") {
      throw new Error(
        `${this.url} does not use https, got ${protocol} instead`
      );
    }
  }

  /**
   * Perform a request to the API and return the replies body (by default
   * decoded from XML).
   *
   * @param route  route to which the request will be sent
   * @param method  The method used to perform the request. Defaults to
   *     [[GET|RequestMethod.GET]]
   * @param payload  An arbitrary object to be sent along with the request. This
   *     object is encoded to XML via xml2js'
   *     [Builder](https://github.com/Leonidas-from-XIV/node-xml2js#xml-builder-usage).
   * @param decodeReply  Flag whether the reply should be assumed to be XML and
   *     be decoded via `xml2js`. Defaults to `true`.
   *
   * @return The body of the reply, optionally decoded from XML via xml2js'
   *     [parseString](https://github.com/Leonidas-from-XIV/node-xml2js#usage). The
   *     reply is only decoded when the request succeeds (`200 <= statusCode <=
   *     299`)
   *
   * @throw An [[ApiError]] if the API replied with a status code less than
   *     `200` or more than `299`.
   */
  public async makeApiCall(
    route: string,
    {
      method,
      payload,
      decodeReply
    }: {
      method?: RequestMethod;
      payload?: any;
      decodeReply?: boolean;
    } = {}
  ): Promise<any> {
    const url = new URL(route, this.url);
    const reqMethod = method === undefined ? RequestMethod.GET : method;
    assert(
      reqMethod !== undefined,
      "request method in reqMethod must not be undefined"
    );

    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          auth: this.headers,
          method: reqMethod
        },
        response => {
          const body: any[] = [];

          response.on("data", chunk => {
            body.push(chunk);
          });

          // handle errors in the request here, because the API returns more
          // detailed error messages in the body, but the body is not available
          // until the "end" event occurs
          response.on("end", async () => {
            try {
              const fullBody = body.join("");
              const data =
                decodeReply !== undefined && !decodeReply
                  ? fullBody
                  : await newXmlParser().parseStringPromise(fullBody);

              if (response.statusCode! < 200 || response.statusCode! > 299) {
                reject(
                  new ApiError(response.statusCode!, url, reqMethod, data)
                );
              }

              resolve(data);
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("error", err => reject(err));

      if (payload !== undefined) {
        req.write(newXmlBuilder().buildObject(payload));
      }
      req.end();
    });
  }
}
