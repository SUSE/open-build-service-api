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
  $: { userid: string; role: LocalRole };
}

/** The information about a [[Group]] as received from OBS */
export interface GroupApiReply {
  $: { groupid: string; role: LocalRole };
}

/** Representation of a user belonging to a [[Project]] */
export interface User {
  readonly userId: string;
  readonly role: LocalRole;
}

/**
 * Converts the data about a user as received from the API to a [[User]]
 * interface.
 */
export function userFromApi(data: UserApiReply): User {
  return {
    role: data.$.role,
    userId: data.$.userid
  };
}

/** Convert a [[User]] interface back to the form that OBS' API expects */
export function userToApi(user: User): UserApiReply {
  return { $: { userid: user.userId, role: user.role } };
}

/** Representation of a group of users belonging to a [[Project]] */
export interface Group {
  readonly groupId: string;
  readonly role: LocalRole;
}

/**
 * Converts the data about a user as received from the API to a [[Group]]
 * interface.
 */
export function groupFromApi(data: GroupApiReply): Group {
  return {
    groupId: data.$.groupid,
    role: data.$.role
  };
}

/** Convert a [[Group]] interface back to the form that OBS' API expects */
export function groupToApi(group: Group): GroupApiReply {
  return { $: { groupid: group.groupId, role: group.role } };
}
