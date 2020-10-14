/**
 * Copyright (c) 2020 SUSE LLC
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

import { Connection, RequestMethod } from "./connection";
import { Package } from "./package";
import { Project } from "./project";
import { Group, LocalRole, User } from "./user";
import {
  mapOrApply,
  mapOrApplyOptional,
  undefinedIfNoInput,
  withoutUndefinedMembers
} from "./util";

/** Possible states of a Review of a request */
export const enum State {
  /** The request has been reviewed */
  Review = "review",
  /** New request without any reviews */
  New = "new",
  /** The request has been accepted */
  Accepted = "accepted",
  /** The request has been declined by the reviewer */
  Declined = "declined",
  /** The request has been revoked by the submitter */
  Revoked = "revoked",
  /** The request has been superseded by a new one */
  Superseded = "superseded",
  /** The request has been deleted */
  Deleted = "deleted"
}

/** Which action should this request achieve? */
export const enum RequestActionType {
  /** The request is the submission of a package to another project */
  Submit = "submit",
  /** Request to delete the project or package */
  Delete = "delete",
  /** Change the devel project of this package */
  ChangeDevel = "change_devel",
  /** Add a user to the package or project */
  AddRole = "add_role",
  /** set the bugowner of the package or project */
  SetBugowner = "set_bugowner",
  MaintenanceIncident = "maintenance_incident",
  MaintenanceRelease = "maintenance_release",
  Group = "group"
}

/** Interface describing the state of the corresponding request */
export interface RequestState {
  /** The state of the corresponding request */
  readonly state?: State;

  /** UserId of the person changing the request's state */
  readonly userId?: string;

  /** Time at which the request's state was changed */
  readonly time?: Date;

  /**
   * If this request has been superseded by another one, then the id of the
   * superseding request will be stored in this field.
   */
  readonly supersededBy?: number;

  /** Comments added to this request state */
  readonly comment?: string;

  /** User id of the user that approved the request */
  readonly approverUserId?: string;
}

interface SourceApiReply {
  $: { project: string; package?: string; rev?: string };
}

/** The source of a Maintenance Release ? */
export interface SourceProject {
  /** Name of the source project */
  readonly projectName: string;
}

/** The source of a submit request */
export interface SourcePackage extends SourceProject {
  /** Name of the package for submit requests */
  readonly packageName: string;
  /** Optional revision of the package for submission */
  readonly revision?: string;
}

function isSourcePackage(
  src: SourcePackage | SourceProject
): src is SourcePackage {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  return (src as any).packageName !== undefined;
}

/** The source of a request */
export type Source = SourceProject | SourcePackage;

function sourceFromApi(src?: SourceApiReply): Source | undefined {
  return undefinedIfNoInput(src, (s) =>
    Object.freeze(
      withoutUndefinedMembers({
        projectName: s.$.project,
        packageName: s.$.package,
        revision: s.$.rev
      })
    )
  );
}

function sourceToApi(src?: Source): SourceApiReply | undefined {
  return undefinedIfNoInput(src, (s) => ({
    $: withoutUndefinedMembers(
      isSourcePackage(s)
        ? { project: s.projectName, package: s.packageName, rev: s.revision }
        : {
            project: s.projectName
          }
    )
  }));
}

interface TargetApiReply {
  $: {
    project: string;
    package?: string;
    releaseproject?: string;
    repository?: string;
  };
}

/** Target of a request */
export interface Target {
  /** Name of the target project */
  readonly projectName: string;

  /** Name of target the package */
  readonly packageName?: string;

  readonly releaseProject?: string;

  /** Repository to be targeted by the request */
  readonly repository?: string;
}

export type PackageTarget = Required<
  Omit<Target, "repository" | "releaseProject">
>;
export type ProjectTarget = Omit<PackageTarget, "packageName">;

function targetFromApi(target?: TargetApiReply): Target | undefined {
  return undefinedIfNoInput(target, (tgt) =>
    Object.freeze(
      withoutUndefinedMembers({
        projectName: tgt.$.project,
        packageName: tgt.$.package,
        releaseProject: tgt.$.releaseproject,
        repository: tgt.$.repository
      })
    )
  );
}

function targetToApi(target?: Target): TargetApiReply | undefined {
  return undefinedIfNoInput(target, (tgt) => ({
    $: withoutUndefinedMembers({
      project: tgt.projectName,
      package: tgt.packageName,
      releaseproject: tgt.releaseProject,
      repository: tgt.repository
    })
  }));
}

export const enum SourceUpdate {
  /**
   * The source package will be updated to the revision created by accepting
   * the request.
   */
  Update = "update",

  /**
   * The source package will stay at the last revision and will not update once
   * the request was accepted
   */
  NoUpdate = "noupdate",

  /** The source package will be removed */
  Cleanup = "cleanup"
}

/** Priority of a request */
export const enum ObsRatings {
  /** work on it when nothing else needs to be done */
  Low = "low",
  /** default: normal priority */
  Moderate = "moderate",
  /** prefer this over the others, but finish your current task first */
  Important = "important",
  /** everything and work only on this */
  Critical = "critical"
}

/** Additional options of a [[Request]] */
export interface RequestOptions {
  /**
   * Specifies what should happen to the source of a submit request once the
   * request gets accepted.
   */
  readonly sourceUpdate?: SourceUpdate;
  readonly makeOriginOlder?: boolean;
}

interface RequestOptionsApiReply {
  readonly sourceupdate?: SourceUpdate;
  readonly makeoriginolder?: "true" | "false";
}

function requestOptionsFromApi(
  options?: RequestOptionsApiReply
): RequestOptions | undefined {
  return undefinedIfNoInput(options, (opt) =>
    Object.freeze(
      withoutUndefinedMembers({
        sourceUpdate: opt.sourceupdate,
        makeOriginOlder: undefinedIfNoInput(
          opt.makeoriginolder,
          (m) => m === "true"
        )
      })
    )
  );
}

function requestOptionsToApi(
  options?: RequestOptions
): RequestOptionsApiReply | undefined {
  return undefinedIfNoInput(options, (opt) =>
    withoutUndefinedMembers({
      sourceupdate: opt.sourceUpdate,
      makeoriginolder:
        opt.makeOriginOlder ?? opt.makeOriginOlder ? "true" : "false"
    })
  );
}

interface AcceptInfoApiReply {
  $: {
    rev: string;
    srcmd5: string;
    osrcmd5: string;
    oproject?: string;
    opackage?: string;
    xsrcmd5?: string;
    oxsrcmd5?: string;
  };
}

/** Object specifying the state in which the request was accepted */
export interface AcceptInfo {
  /** The revision which is created by accepting this request */
  readonly revision: string;
  /** md5 hash of the created revision */
  readonly sourceMd5: string;
  /** md5 hash of the previous revision */
  readonly originalSourceMd5: string;

  /** This field contains the name of the actual project to which the package belongs for maintenance releases. */
  readonly originalProject?: string;
  /** This field contains the name of the actual package for maintenance releases. */
  readonly originalPackage?: string;

  /**
   * Md5 hash of the expanded sources of the newly created revision.
   * This field does only exist, if the target package is a link.
   */
  readonly expandedSourceMd5?: string;
  /**
   * Md5 hash of the expanded sources of the previous revision.
   * This field does only exist, if the target package is a link.
   */
  readonly originalExpandedSourceMd5?: string;
}

function acceptInfoFromApi(
  acceptinfo?: AcceptInfoApiReply
): AcceptInfo | undefined {
  return undefinedIfNoInput(acceptinfo, (acpt) =>
    Object.freeze(
      withoutUndefinedMembers({
        revision: acpt.$.rev,
        sourceMd5: acpt.$.srcmd5,
        originalSourceMd5: acpt.$.osrcmd5,
        originalProject: acpt.$.oproject,
        originalPackage: acpt.$.opackage,
        expandedSourceMd5: acpt.$.xsrcmd5,
        originalExpandedSourceMd5: acpt.$.oxsrcmd5
      })
    )
  );
}

function acceptInfoToApi(
  acceptInfo?: AcceptInfo
): AcceptInfoApiReply | undefined {
  return undefinedIfNoInput(acceptInfo, (acpt) => ({
    $: withoutUndefinedMembers({
      rev: acpt.revision,
      srcmd5: acpt.sourceMd5,
      osrcmd5: acpt.originalSourceMd5,
      oproject: acpt.originalProject,
      opackage: acpt.originalPackage,
      xsrcmd5: acpt.expandedSourceMd5,
      oxsrcmd5: acpt.originalExpandedSourceMd5
    })
  }));
}

interface RequestUserApiReply {
  $: { name: string; role?: LocalRole };
}

interface RequestGroupApiReply {
  $: { name: string; role?: LocalRole };
}

function userFromRequestUserApi(usr?: RequestUserApiReply): User | undefined {
  return undefinedIfNoInput(usr, (u) =>
    withoutUndefinedMembers({ id: u.$.name, role: u.$.role })
  );
}

function userToRequestUserApi(usr?: User): RequestUserApiReply | undefined {
  return undefinedIfNoInput(usr, (u) =>
    withoutUndefinedMembers({
      $: withoutUndefinedMembers({ name: u.id, role: u.role })
    })
  );
}

function groupFromRequestGroupApi(
  grp?: RequestGroupApiReply
): Group | undefined {
  return undefinedIfNoInput(grp, (g) =>
    withoutUndefinedMembers({ id: g.$.name, role: g.$.role })
  );
}

function groupToRequestGroupApi(grp?: Group): RequestGroupApiReply | undefined {
  return undefinedIfNoInput(grp, (g) =>
    withoutUndefinedMembers({
      $: withoutUndefinedMembers({ name: g.id, role: g.role })
    })
  );
}

interface RequestActionApiReply {
  $: { type: RequestActionType };
  source?: SourceApiReply;
  target?: TargetApiReply;
  person?: RequestUserApiReply;
  group?: RequestGroupApiReply;
  // no `grouped` in here, that is deprecated/never really used
  options?: RequestOptionsApiReply;
  acceptinfo?: AcceptInfoApiReply;
}

/** An action that will be performed by accepting a request. */
export interface RequestAction {
  /** The action type. It specifies which of the fields are required. */
  readonly type: RequestActionType;
  /** Source of this request (required for submitrequests and maintenance releases) */
  readonly source?: Source;
  /** target of this request, required for nearly everything */
  readonly target?: Target;
  /** User that is involved in role addition requests */
  readonly person?: User;
  /** Group that is involved in role addition requests */
  readonly group?: Group;
  /** Additional options for this request */
  readonly options?: RequestOptions;
  /**
   * This field contains information about the result of this request once it is
   * accepted.
   */
  readonly acceptInfo?: AcceptInfo;
}

function requestActionFromApi(
  requestAction: RequestActionApiReply
): RequestAction {
  return Object.freeze(
    withoutUndefinedMembers({
      type: requestAction.$.type,
      source: sourceFromApi(requestAction.source),
      target: targetFromApi(requestAction.target),
      person: userFromRequestUserApi(requestAction.person),
      group: groupFromRequestGroupApi(requestAction.group),
      options: requestOptionsFromApi(requestAction.options),
      acceptInfo: acceptInfoFromApi(requestAction.acceptinfo)
    })
  );
}

function requestActionToApi(action: RequestAction): RequestActionApiReply {
  return withoutUndefinedMembers({
    $: { type: action.type },
    source: sourceToApi(action.source),
    target: targetToApi(action.target),
    person: userToRequestUserApi(action.person),
    group: groupToRequestGroupApi(action.group),
    options: requestOptionsToApi(action.options),
    acceptinfo: acceptInfoToApi(action.acceptInfo)
  });
}

interface RequestHistoryApiReply {
  $: { who: string; when: string };
  description: string;
  comment?: string;
}

/** A change of the request is recorded as one of the following elements */
export interface RequestHistory {
  /**
   * The user whose action resulted in the request changing (mostly them
   * reviewing the request)
   */
  readonly userId: string;
  /** Time at which history entry took place */
  readonly time: Date;
  /** description of this event */
  readonly description: string;
  /** longer description of this event */
  readonly comment?: string;
}

function requestHistoryFromApi(hist: RequestHistoryApiReply): RequestHistory {
  return Object.freeze(
    withoutUndefinedMembers({
      userId: hist.$.who,
      time: new Date(hist.$.when),
      description: hist.description,
      comment: hist.comment
    })
  );
}

function requestHistoryToApi(hist: RequestHistory): RequestHistoryApiReply {
  const { userId, time, description, comment } = hist;
  return withoutUndefinedMembers({
    $: { who: userId, when: time.toISOString() },
    description,
    comment
  });
}

interface RequestReviewApiReply {
  $: {
    state: State;
    by_user?: string;
    by_group?: string;
    by_project?: string;
    by_package?: string;
    who?: string;
    when?: string;
  };
  comment?: string;
  history?: RequestHistoryApiReply | RequestHistoryApiReply[];
}

export interface UserReviewer {
  readonly userId: string;
}

export interface GroupReviewer {
  readonly groupId: string;
}

/**
 * Defines who should review a request:
 * - [[UserReviewer]]/[[GroupReviewer]]: the respective user or group.
 * - [[PackageTarget]]/[[ProjectTarget]]: the maintainers/reviewers of the
 *   package or project
 */
export type RequestedReviewer =
  | UserReviewer
  | GroupReviewer
  | PackageTarget
  | ProjectTarget;

function isUserReviewer(rev: RequestedReviewer): rev is UserReviewer {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  return (rev as any).userId !== undefined;
}

function isGroupReviewer(rev: RequestedReviewer): rev is GroupReviewer {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  return (rev as any).groupId !== undefined;
}

/** Description of a review for a request */
export interface RequestReview {
  /** state of the review */
  readonly state: State;

  /**
   * The person or group or project/package that was requested for this review.
   *
   * Either a user or a group can be set as reviewers directly, or the reviewers
   * can be taken from a project or a package (then OBS will prompt the
   * maintainers of the project or package for review).
   */
  readonly requestedReviewer: RequestedReviewer;

  /** If this request was reviewed, then the reviewer's user id is stored in this field */
  readonly reviewedBy?: string;
  /** The time at which the request was reviewed */
  readonly reviewedAt?: Date;
  /** Changes of this review are recorded here */
  readonly reviewHistory: RequestHistory[];
  /** Comment explaining the decision of this review */
  readonly comment?: string;
}

function requestReviewFromApi(review: RequestReviewApiReply): RequestReview {
  const { by_user, by_group, by_package, by_project } = review.$;
  if (
    by_user === undefined &&
    by_project === undefined &&
    by_group === undefined
  ) {
    throw new Error(
      "Invalid review API reply received: by_user, by_group and by_project are all undefined"
    );
  }

  const requestedReviewer = Object.freeze(
    by_user !== undefined
      ? { userId: by_user }
      : by_group !== undefined
      ? { groupId: by_group }
      : withoutUndefinedMembers({
          projectName: by_project!,
          packageName: by_package
        })
  );

  return Object.freeze(
    withoutUndefinedMembers({
      state: review.$.state,
      requestedReviewer,
      reviewedBy: review.$.who,
      reviewedAt: undefinedIfNoInput(review.$.when, (w) => new Date(w)),
      comment: review.comment,
      reviewHistory: mapOrApply(review.history ?? [], requestHistoryFromApi)
    })
  );
}

function requestReviewToApi(review: RequestReview): RequestReviewApiReply {
  const {
    state,
    requestedReviewer,
    reviewedBy,
    reviewedAt,
    reviewHistory,
    comment
  } = review;
  let by_group, by_user, by_project, by_package;
  if (isUserReviewer(requestedReviewer)) {
    by_user = requestedReviewer.userId;
  } else if (isGroupReviewer(requestedReviewer)) {
    by_group = requestedReviewer.groupId;
  } else {
    by_project = requestedReviewer.projectName;
    // ProjectTarget has no packageName, so this will be just undefined if
    // requestedReviewer is a ProjectTarget
    by_package = (requestedReviewer as PackageTarget).packageName;
  }
  return withoutUndefinedMembers({
    $: withoutUndefinedMembers({
      state: state,
      by_group,
      by_user,
      by_package,
      by_project,
      who: reviewedBy,
      when: reviewedAt?.toISOString()
    }),
    comment,
    history: mapOrApplyOptional(reviewHistory, requestHistoryToApi)
  });
}

/** Representation of request on the Open Build Service */
export interface Request {
  /** Unique identifier of this request. */
  readonly id?: number;

  /** User id of the creator of this request. */
  readonly creatorUserId?: string;

  /** Optional description of this request */
  readonly description?: string;

  /** The state of this request */
  readonly state?: RequestState;

  /** Set of actions that will be performed once the request is accepted */
  readonly actions: RequestAction[];

  /** Optional priority of this request */
  readonly priority?: ObsRatings;

  /** History of this request */
  readonly history: RequestHistory[];

  /**
   * Administrators can set this field which specifies when this request will be
   * automatically accepted (it can still be declined).
   */
  readonly autoAcceptAt?: Date;

  /** Reviews for this request. */
  readonly reviews: RequestReview[];
}

/** Data structure that needs to be populated to create a new Request */
export type RequestCreation = Omit<
  Request,
  "id" | "history" | "state" | "creatorUserId"
>;

/** An already existing [[Request]] */
export type ExistingRequest = Omit<Request, "id" | "creatorUserId"> & {
  readonly id: number;
  readonly creatorUserId: string;
};

function requestStateFromApi(
  reqState: RequestStateApiReply | undefined
): RequestState | undefined {
  const supersededBy = reqState?.$.superseded_by;
  return undefinedIfNoInput(reqState, (req) =>
    Object.freeze(
      withoutUndefinedMembers({
        state: req.$.name,
        userId: req.$.who,
        time: undefinedIfNoInput(req.$.when, (w) => new Date(w)),
        supersededBy: undefinedIfNoInput(supersededBy, (s) => parseInt(s, 10)),
        approverUserId: req.$.approver,
        comment: req.comment
      })
    )
  );
}

interface RequestStateApiReply {
  $: {
    name?: State;
    who?: string;
    when?: string;
    approver?: string;
    superseded_by?: string;
  };
  comment: string;
}

interface RequestApiReply {
  request: {
    $?: { id?: string; creator?: string };
    action?: RequestActionApiReply | RequestActionApiReply[];
    state?: RequestStateApiReply;
    description?: string;
    priority?: ObsRatings;
    review?: RequestReviewApiReply | RequestReviewApiReply[];
    history?: RequestHistoryApiReply | RequestHistoryApiReply[];
    accept_at?: string;
  };
}

function requestFromApi(req: RequestApiReply): Request {
  return Object.freeze(
    withoutUndefinedMembers({
      id: undefinedIfNoInput(req.request.$?.id, (id) => parseInt(id, 10)),
      creatorUserId: req.request.$?.creator,
      actions: mapOrApplyOptional(req.request.action, requestActionFromApi),
      state: requestStateFromApi(req.request.state),
      description: req.request.description,
      priority: req.request.priority,
      reviews: mapOrApplyOptional(req.request.review, requestReviewFromApi),
      history: mapOrApplyOptional(req.request.history, requestHistoryFromApi),
      autoAcceptAt: undefinedIfNoInput(
        req.request.accept_at,
        (acpt) => new Date(acpt)
      )
    })
  );
}

function requestToApi(req: RequestCreation): RequestApiReply {
  const { actions, description, priority, reviews } = req;

  return {
    request: withoutUndefinedMembers({
      description,

      action: mapOrApplyOptional(actions, requestActionToApi),
      review: mapOrApplyOptional(reviews, requestReviewToApi),
      priority,
      // ensure that we use UTC for the time string, as OBS will use UTC
      // implicitly
      accept_at: undefinedIfNoInput(req.autoAcceptAt, (d) => d.toISOString())
    })
  };
}

/**
 * Retrieve the information about a request given its `id` and populate a
 * [[Request]] data structure.
 *
 * @param con  The [[Connection]] via which the API calls will be performed.
 * @param id  The identifier of the request.
 *
 * @return The request with the specified id (this field is guaranteed to be
 *     set and to equal to the parameter `id`).
 * @throw
 *     - an `Error` if id is smaller than zero
 *     - an `Error` if OBS replies with a request that has a different id than `id`
 *       or none at all
 *     - an [[ApiError]] if a call to the API fails
 */
export async function fetchRequest(
  con: Connection,
  id: number
): Promise<ExistingRequest> {
  if (id < 0) {
    throw new Error("request id must not be smaller than zero");
  }
  const req = requestFromApi(
    await con.makeApiCall<RequestApiReply>(`/request/${id}`)
  );
  const { id: idFromObs, creatorUserId, ...rest } = req;
  if (id === undefined || idFromObs !== id) {
    throw new Error(
      `received an invalid reply from OBS: expected request ${id} but got ${
        idFromObs ?? "undefined"
      }`
    );
  }
  if (creatorUserId === undefined) {
    throw new Error("creator of this request must be set, but it is not");
  }
  return { id, creatorUserId, ...rest };
}

/**
 * Low level function to creates a new request.
 *
 * @param con  Connection that is used to perform API calls. The user, whose
 *     credentials are stored in the [[Connection]], will be the creator of this
 *     request (recorded in the [[Request.creatorUserId]] field). Note that this
 *     determines whether certain requests can be made (e.g. only administrators
 *     can set the [[Request.autoAcceptAt]] field).
 * @param req  Request that should be created.
 *
 * @return The newly created [[Request]] as received from OBS.
 */
export async function createRequest(
  con: Connection,
  req: RequestCreation
): Promise<ExistingRequest> {
  const reqReply = requestFromApi(
    await con.makeApiCall<RequestApiReply>("/request?cmd=create", {
      method: RequestMethod.POST,
      payload: requestToApi(req)
    })
  );
  if (reqReply.id === undefined || reqReply.creatorUserId === undefined) {
    throw new Error(
      "Invalid request reply: id or creatorUserId are undefined, but they must not be"
    );
  }
  if (reqReply.creatorUserId !== con.username) {
    throw new Error(
      `Request should have the 'creator' ${con.username}, but got ${reqReply.creatorUserId}`
    );
  }
  const { id, creatorUserId, ...rest } = reqReply;
  return { id, creatorUserId, ...rest };
}

function isProject(
  proj: PackageTarget | ProjectTarget | Project | Package
): proj is Project {
  return (
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    (proj as any).apiUrl !== undefined &&
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    (proj as any).projectName === undefined
  );
}

function isPackage(
  pkg: PackageTarget | ProjectTarget | Project | Package
): pkg is Package {
  return (
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    (pkg as any).apiUrl !== undefined && (pkg as any).projectName !== undefined
  );
}

/**
 * Create a submitrequest of a package to a project or a package.
 *
 * @param source  The package to be submitted
 * @param target  The destination of the submission. If a [[Project]] is given or
 *     if the [[Target.packageName]] field is unset, then the target package
 *     name is equal to the source package name.
 *
 * @return The created submitrequest.
 */
export function submitPackage(
  con: Connection,
  source: SourcePackage | Package,
  target:
    | Required<Omit<Target, "repository" | "releaseProject">>
    | Project
    | Package
): Promise<ExistingRequest> {
  const src: Source = isPackage(source)
    ? { packageName: source.name, projectName: source.projectName }
    : source;
  const tgt: Target = isPackage(target)
    ? { projectName: target.projectName, packageName: target.name }
    : isProject(target)
    ? { projectName: target.name }
    : target;
  const newReq: RequestCreation = {
    actions: [{ type: RequestActionType.Submit, source: src, target: tgt }],
    reviews: []
  };
  return createRequest(con, newReq);
}

/**
 * Create a delete request against the target package or project.
 *
 * @param target  The project or package which deletion is requested.
 * @param autoAcceptAt  Date at which the request will be automatically accepted
 *     unless the reviewer declines it or the creator revokes it.
 *     Note that only administrators can set this property.
 *
 * @return The resulting deleterequest.
 */
export function requestDeletion(
  con: Connection,
  target: PackageTarget | ProjectTarget | Project | Package,
  autoAcceptAt?: Date
): Promise<ExistingRequest> {
  const tgt: PackageTarget | ProjectTarget = isPackage(target)
    ? { projectName: target.projectName, packageName: target.name }
    : isProject(target)
    ? { projectName: target.name }
    : target;
  const newReq: RequestCreation = {
    actions: [
      {
        type: RequestActionType.Delete,
        target: tgt
      }
    ],
    // reviews: [{ state: State.New, requestedReviewer: tgt, reviewHistory: [] }],
    reviews: [],
    autoAcceptAt
  };
  return createRequest(con, newReq);
}

/**
 * Fetches the server-side rendered diff of the request with the supplied id.
 *
 * @return A diff of this request sorted by changes, spec and other files. The
 *     diff also includes changes inside archives, if the archives or changes
 *     are not too large.
 */
export async function fetchRequestDiff(
  con: Connection,
  id: number
): Promise<string> {
  return (
    await con.makeApiCall(`/request/${id}?cmd=diff`, {
      method: RequestMethod.POST,
      decodeResponseFromXml: false
    })
  ).toString();
}
