/**
 * Copyright (c) 2020-2022 SUSE LLC
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
import { Connection, RequestMethod } from "./connection";
import { statusReplyFromApi } from "./error";
import { BasePackage, Package } from "./package";
import { User, UserWithRole } from "./user";
import { mapOrApplyOptional, strToInt, withoutUndefinedMembers } from "./util";

type UserVariant = User | UserWithRole | string;

const getUserId = (user: UserVariant): string =>
  typeof user === "string" ? user : user.id;

const enum TokenKindOnly {
  RSS = "rss"
}

export const enum TokenOperation {
  RunService = "runservice",
  Rebuild = "rebuild",
  Release = "release"
}

type TokenKindHelper = TokenOperation | TokenKindOnly;

const operationToKind = (operation: TokenOperation): TokenKind =>
  (operation as unknown) as TokenKind;

/** Possible token types */
export const enum TokenKind {
  /** The token can be used to trigger service runs */
  RunService = "runservice",
  /** The token can trigger rebuilds of packages */
  Rebuild = "rebuild",
  /** The token is used to release packages/projects */
  Release = "release",
  /** This token is used to access the user's RSS feed */
  RSS = "rss"
}

const TokenKinds: TokenKindHelper[] = [
  TokenOperation.RunService,
  TokenOperation.Rebuild,
  TokenOperation.Release,
  TokenKindOnly.RSS
];

/**
 * Tokens can be used as an alternative authentication method instead of the
 * username + password combination. However, tokens can only be bound to
 * specific actions, they are only bound to a certain user and can optionally be
 * also bound to a certain package to limit the impact if they should get
 * leaked.
 */
export interface Token {
  /**
   * The tokens unique identifier.
   * Currently this id is used to delete it later on.
   */
  readonly id: number;

  /** The username of the user to whom this token belongs. */
  readonly userId: string;

  /** The secret that is used for the actual authentication */
  readonly string: string;

  /** The type of this token, i.e. the action that is allowed to perform */
  readonly kind: TokenKind;

  /**
   * An optional package to which this token is bound. If undefined/omitted,
   * then this token is valid for all packages that the user has access to.
   */
  readonly package?: Omit<BasePackage, "apiUrl">;
}

/** Type check whether an object is a [[Token]] */
export function isToken(obj: any): obj is Token {
  return (
    obj.kind !== undefined &&
    typeof obj.id === "number" &&
    typeof obj.userId === "string" &&
    typeof obj.string === "string"
  );
}

interface TokenDentryAttributes {
  id: string;
  string: string;
  kind: string;
}

interface PackageTokenDentryAttributes extends TokenDentryAttributes {
  project: string;
  package: string;
}

function isPackageTokenDentryAttributes(
  dentryAttrs: TokenDentryAttributes | PackageTokenDentryAttributes
): dentryAttrs is PackageTokenDentryAttributes {
  return (
    (dentryAttrs as any).package !== undefined &&
    (dentryAttrs as any).project !== undefined
  );
}

interface TokendDirectoryEntry {
  $: TokenDentryAttributes | PackageTokenDentryAttributes;
}

interface TokensApiReply {
  directory: {
    $: { count: number };
    entry: TokendDirectoryEntry[] | TokendDirectoryEntry | undefined;
  };
}

function tokensFromApi(token: TokensApiReply, userId: string): Token[] {
  const convertIner = (dentry: TokendDirectoryEntry): Token => {
    const { id, kind, string } = dentry.$;
    if (TokenKinds.find((k) => k === kind) === undefined) {
      throw new Error(`Invalid token kind ${kind} received`);
    }

    const pkg = isPackageTokenDentryAttributes(dentry.$)
      ? { name: dentry.$.package, projectName: dentry.$.project }
      : undefined;

    return withoutUndefinedMembers({
      id: strToInt(id),
      string,
      userId,
      kind: kind as TokenKind,
      package: pkg
    });
  };
  return mapOrApplyOptional(token.directory.entry, convertIner);
}

/**
 * Fetch the list of tokens that have been created for the specified `user`.
 */
export async function fetchTokens(
  con: Connection,
  user: UserVariant
): Promise<Token[]> {
  const userId = getUserId(user);
  const tokens: TokensApiReply = await con.makeApiCall(
    `/person/${userId}/token`
  );
  return tokensFromApi(tokens, userId);
}

/** Additional settings to create a token */
export interface TokenCreationOptions {
  /** Binds the token to a specific package */
  readonly package?: Omit<Package, "apiUrl">;

  /**
   * Operation that the token is allowed to perform. Defaults to
   * [[TokenOperation.RunService]].
   */
  readonly operation?: TokenOperation;
}

/**
 * Create a new [[Token]] for the supplied user.
 *
 * @param con  The [[Connection]] to be used to perform the API calls
 * @param user  The user for whom the token should be created
 * @param options  Additional setting for creating a token:
 *     - options.package: binds the token to a specific package, if omitted, then
 *       the token is valid for all packages that the user has access to
 *     - options.operation: the operation that can be performed via this token,
 *       defaults to [[TokenOperation.RunService]]
 *
 * @return The newly created token.
 */
export async function createToken(
  con: Connection,
  user: User | UserWithRole | string,
  options?: TokenCreationOptions
): Promise<Token> {
  const userId = getUserId(user);
  let route = `/person/${userId}/token?cmd=create`;

  if (options?.package !== undefined) {
    route = route.concat(
      `&project=${options.package.projectName}&package=${options.package.name}`
    );
  }
  if (options?.operation !== undefined) {
    route = route.concat(`&operation=${options.operation}`);
  }

  const status = statusReplyFromApi(
    await con.makeApiCall(route, {
      method: RequestMethod.POST
    })
  );

  let token: Token;
  if (
    status.data !== undefined &&
    status.data["token"] !== undefined &&
    status.data["id"] !== undefined
  ) {
    token = {
      id: strToInt(status.data["id"], 10),
      string: status.data["token"],
      kind: operationToKind(options?.operation ?? TokenOperation.RunService),
      userId
    };
    if (options?.package !== undefined) {
      token = { ...token, package: options.package };
    }
  } else {
    const tokens = await fetchTokens(con, user);
    token = tokens[tokens.length - 1];
  }
  return token;
}

/** Deletes a token given its id and the user to whom it belongs. */
export async function deleteToken(
  con: Connection,
  user: UserVariant,
  tokenId: number
): Promise<void>;

/** Deletes the supplied token. */
export async function deleteToken(con: Connection, token: Token): Promise<void>;

export async function deleteToken(
  con: Connection,
  userOrToken: UserVariant | Token,
  tokenId?: number
): Promise<void> {
  let userId: string;
  let id: number;
  if (isToken(userOrToken)) {
    assert(
      tokenId === undefined,
      "Overload of deleteToken used wrongly: tokenId must be undefined when the 2nd argument is a Token"
    );
    userId = userOrToken.userId;
    id = userOrToken.id;
  } else {
    assert(
      tokenId !== undefined,
      "Overload of deleteToken used wrongly: tokenId must be defined when the 2nd argument is a user or username"
    );
    userId = getUserId(userOrToken);
    id = tokenId;
  }
  await con.makeApiCall(`/person/${userId}/token/${id}`, {
    method: RequestMethod.DELETE
  });
}
