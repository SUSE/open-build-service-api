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

import { withoutUndefinedMembers, undefinedIfNoInput } from "./util";

/** roles of a Person or a Group belonging to a project */
export enum LocalRole {
  /** This person or group maintains the project and has all rights */
  Maintainer = "maintainer",

  /**
   * The bugowner is the person/group to whom bugs get assigned.
   *
   * If no bugowner is set, then the "Report Bug" will **not** show up.
   */
  Bugowner = "bugowner",
  Reviewer = "reviewer",
  Downloader = "downloader",
  Reader = "reader"
}

/** The information about a [[User]] as received from OBS */
export interface UserApiReply {
  $: { userid: string; role?: LocalRole };
}
export type UserWithRoleApiReply = Required<UserApiReply>;

/** The information about a [[Group]] as received from OBS */
export interface GroupApiReply {
  $: { groupid: string; role?: LocalRole };
}
export type GroupWithRoleApiReply = Required<GroupApiReply>;

/** A user with an optional role. */
export interface User {
  /** The user's id (= their username) */
  readonly id: string;
  /** An optional user role, if applicable in this context. */
  readonly role?: LocalRole;
}

/** A user with a specified role */
export type UserWithRole = Required<User>;

export function userFromApi(data: undefined): undefined;
export function userFromApi(data: UserApiReply): User;
export function userFromApi(data: UserWithRoleApiReply): UserWithRole;
export function userFromApi(data?: UserApiReply): User | undefined;
/**
 * Converts the data about a user as received from the API to a [[User]]
 * interface.
 */
export function userFromApi(
  data?: UserApiReply | UserWithRoleApiReply
): UserWithRole | User | undefined {
  return data === undefined
    ? undefined
    : Object.freeze(
        withoutUndefinedMembers({
          role: data.$.role,
          id: data.$.userid
        })
      );
}

export function userToApi(user: undefined): undefined;
export function userToApi(user: UserWithRole): UserWithRoleApiReply;
export function userToApi(user: User): UserApiReply;
export function userToApi(user?: User): UserApiReply | undefined;
export function userToApi(
  user?: UserWithRole
): UserWithRoleApiReply | undefined;

/** Convert a [[User]] interface back to the form that OBS' API expects */
export function userToApi(
  user?: UserWithRole | User
): UserApiReply | UserWithRoleApiReply | undefined {
  return undefinedIfNoInput(user, (u) => ({
    $: withoutUndefinedMembers({ userid: u.id, role: u.role })
  }));
}

/** A group of users in the Open Build Service */
export interface Group {
  readonly id: string;
  readonly role?: LocalRole;
}

/** Representation of a group of users belonging to a [[Project]] */
export type GroupWithRole = Required<Group>;

export function groupFromApi(data: undefined): undefined;
export function groupFromApi(data: GroupApiReply): Group;
export function groupFromApi(data: GroupWithRoleApiReply): GroupWithRole;
export function groupFromApi(data?: GroupApiReply): Group | undefined;

/**
 * Converts the data about a user as received from the API to a [[Group]]
 * interface.
 */
export function groupFromApi(
  data?: GroupApiReply | GroupWithRoleApiReply
): Group | GroupWithRole | undefined {
  return undefinedIfNoInput(data, (g) =>
    Object.freeze(
      withoutUndefinedMembers({
        id: g.$.groupid,
        role: g.$.role
      })
    )
  );
}

export function groupToApi(group: undefined): undefined;
export function groupToApi(group: Group): GroupApiReply;
export function groupToApi(group: GroupWithRole): GroupWithRoleApiReply;
export function groupToApi(group?: Group): GroupApiReply | undefined;
export function groupToApi(
  group?: GroupWithRole
): GroupWithRoleApiReply | undefined;

/** Convert a [[Group]] interface back to the form that OBS' API expects */
export function groupToApi(
  group?: Group | GroupWithRole
): GroupApiReply | GroupWithRoleApiReply | undefined {
  return undefinedIfNoInput(group, (g) => ({
    $: withoutUndefinedMembers({ groupid: g.id, role: g.role })
  }));
}

/** Permissions of a user or a user group */
export interface Permissions {
  /** user or group id */
  readonly id: string;

  /** Roles of the user or group */
  roles: LocalRole[];
}
