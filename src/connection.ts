"use strict";

import xml2js = require("xml2js");
const xml_parser = new xml2js.Parser({ explicitArray: false, async: true });
const ConfigIniParser = require("config-ini-parser").ConfigIniParser;

import { request } from "https";
import { readFileSync } from "fs";
import { homedir } from "os";

// Class for storing the credentials to connect to a Open Build Service instance.
export class Connection {
  // the user's password
  private readonly password: string;

  // the username which will be used to connect to the API
  readonly username: string;

  // HTTP simple auth header for fetch containing the necessary credentials
  private readonly headers: string;

  // Construct a connection either using the provided username and password or reading them from the user's oscrc if they are omitted.
  constructor(
    username?: string,
    password?: string,
    readonly url: string = "https://api.opensuse.org"
  ) {
    if ((username === undefined) !== (password === undefined)) {
      throw new Error(
        "Either don't provide a username and password or provide both, only providing one is not allowed."
      );
    }
    if (password === undefined) {
      const oscrc = homedir().concat("/.config/osc/oscrc");

      const parser = new ConfigIniParser();
      const oscrc_contents = parser.parse(readFileSync(oscrc).toString());
      this.password = oscrc_contents.get(url, "pass");
      this.username = oscrc_contents.get(url, "user");
    } else {
      this.password = password!;
      this.username = username!;
    }

    this.headers = `${this.username}:${this.password}`;
    //     new Headers({
    // Authorization:
    //   "Basic " +
    //   Buffer.from(this.username + ":" + this.password).toString("base64")
    // });
  }

  async makeApiCall(route: string, method: string = "GET"): Promise<any> {
    const url = this.url.concat(route);

    return new Promise((resolve, reject) => {
      const req = request(
        url,
        { method: method, auth: this.headers },
        response => {
          if (response.statusCode! < 200 || response.statusCode! > 299) {
            reject(
              new Error(
                `Failed to load URL ${url}, status code: ${response.statusCode}`
              )
            );
          }

          const body: any[] = [];
          response.on("data", chunk => {
            body.push(chunk);
          });
          response.on("end", async () =>
            resolve(await xml_parser.parseStringPromise(body.join("")))
          );
        }
      );
      req.on("error", err => reject(err));
      req.end();
    });
  }
  // resolve => {
  //   fetch(url, { headers: this.headers, method: method })
  //     .then(response => Connection.validateResponseStatus(response))
  //     .then(response => response.text())
  //     .then(str =>
  //       xml_parser
  //         .parseStringPromise(str)
  //         .then((result: any) => resolve(result))
  //     );
  // });
}
