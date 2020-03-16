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

import { promises as fsPromises } from "fs";
import { homedir } from "os";
import { normalizeUrl } from "./connection";

// tslint:disable-next-line: no-var-requires
const ConfigIniParser = require("config-ini-parser").ConfigIniParser;

export class Account {
  public aliases: string[];
  public username: string;
  public password: string | undefined;
  public readonly apiUrl: string;
  public realname?: string;
  public email?: string;

  constructor({
    username,
    password,
    apiUrl,
    realname,
    email,
    aliases
  }: {
    username: string;
    password: string | undefined;
    apiUrl: string;
    realname?: string;
    email?: string;
    aliases?: string[];
  }) {
    this.username = username;
    this.password = password;
    this.apiUrl = normalizeUrl(apiUrl);
    this.realname = realname;
    this.email = email;
    aliases === undefined ? (this.aliases = []) : (this.aliases = aliases);
  }
}

/**
 * @returns The expected location of osc's configuration file (oscrc).
 */
function getDefaultOscrcLocation(): string {
  return homedir().concat("/.config/osc/oscrc");
}

async function readOsrc(oscrcLocation?: string): Promise<string | undefined> {
  try {
    const oscrc = await fsPromises.readFile(
      oscrcLocation === undefined ? getDefaultOscrcLocation() : oscrcLocation
    );
    return oscrc === undefined ? undefined : oscrc.toString();
  } catch (err) {
    // TODO: log the error
    return undefined;
  }
}

/**
 * Reads the oscrc configuration file and extract all defined accounts
 */
export async function readAccountsFromOscrc(
  oscrcLocation?: string
): Promise<Account[]> {
  const oscrc = await readOsrc(oscrcLocation);
  if (oscrc === undefined) {
    return [];
  }

  const parser = new ConfigIniParser();
  const oscrcContents = parser.parse(oscrc);

  const sections: string[] = oscrcContents.sections();

  return sections
    .filter(sect => {
      return sect !== "general";
    })
    .map(sect => {
      const sectionElementGetter = (optionName: string) => {
        const res: string | 1 = oscrcContents.get(sect, optionName, 1);
        return res === 1 ? undefined : res;
      };

      const aliases = sectionElementGetter("aliases");
      return new Account({
        aliases: aliases === undefined ? [] : aliases.split(","),
        apiUrl: sect,
        email: sectionElementGetter("email"),
        password: sectionElementGetter("pass"),
        realname: sectionElementGetter("realname"),
        username: oscrcContents.get(sect, "user")
      });
    });
}

/**
 * Adds the passed account to the specified oscrc configuration file, if any
 * account for the specified API URL is not yet present.
 *
 * This function will **never** write the password to the oscrc configuration
 * file.
 */
export async function addAccountToOscrc(
  account: Account,
  oscrcLocation?: string
): Promise<void> {
  let oscrc = await readOsrc(oscrcLocation);

  if (oscrc === undefined || (oscrc !== undefined && oscrc.length === 0)) {
    oscrc = `
[general]
`;
  }

  const parser = new ConfigIniParser();
  const oscrcContents = parser.parse(oscrc);

  // we need to explicitly construct a URL from the section name, as the URL
  // constructor will append a / to URL and thus a isHaveSection(account.apiUrl)
  // doesn't work
  // Also, we need to convert the URLs to strings, as comparing two equal URL
  // objects with === still yields false. Because of reasons (I'm sure about
  // that).
  oscrcContents.sections().forEach((sect: string) => {
    if (sect === "general") {
      return;
    }
    if (normalizeUrl(sect) === account.apiUrl.toString()) {
      throw new Error(`Cannot add ${account.apiUrl} to oscrc: already present`);
    }
  });

  oscrc += `[${account.apiUrl}]
`;

  const props: { prop: keyof Account; propName?: string }[] = [
    { prop: "username", propName: "user" },
    { prop: "email" },
    { prop: "realname" }
  ];
  props.forEach(({ prop, propName }) => {
    if (account[prop] !== undefined) {
      oscrc += `${propName !== undefined ? propName : prop} = ${account[prop]}
`;
    }
  });
  if (account.aliases.length > 0) {
    oscrc += `aliases = ${account.aliases.toString()}
`;
  }

  await fsPromises.writeFile(
    oscrcLocation === undefined ? getDefaultOscrcLocation() : oscrcLocation,
    oscrc
  );
}

/* export async function writeAccountsToOsrc(
  accounts: ReadonlyArray<Account>
): Promise<void> {
  if (accounts.length === 0) {
    return;
  }

  const oscrc = await readOsrc();
  const parser = new ConfigIniParser();

  let oscrcContents: any | undefined;

  if (oscrc === undefined) {
    oscrcContents = parser.parse("");
    oscrcContents.addSection("general");
    oscrcContents.set("general", "apiurl", accounts[0].apiUrl);
  } else {
    oscrcContents = parser.parse(oscrc);
  }

  accounts.forEach(acc => {
    if (!oscrcContents.isHaveSection(acc.apiUrl)) {
      oscrcContents.addSection(acc.apiUrl);

      const props: Array<keyof Account> = ["username", "email", "realname"];
      props.forEach(prop => {
        if (acc[prop] !== undefined) {
          oscrcContents.set(acc.apiUrl, prop, acc[prop]);
        }
      });
    }
  });

  await writeFileP(getDefaultOscrcLocation(), oscrcContents.stringify("\n"));
} */
