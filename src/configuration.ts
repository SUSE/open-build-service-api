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

import { URL } from "url";
import { Arch } from "./api/base-types";
import { ChoiceOption, choiceToBoolean } from "./api/choice";
import { Connection } from "./connection";
import { withoutUndefinedMembers, extractElementIfPresent } from "./util";

/**
 * Publicly readable configuration of this OBS instance.
 */
export interface Configuration {
  /** short description of this OBS instance showed in the webui */
  readonly title: string;

  /** long description of this OBS instance showed in the webui on main page */
  readonly description: string;

  /**
   * webui (or other sites) can show the content of the OBS instance also to not
   * logged in users.
   */
  readonly anonymous?: boolean;

  /**
   * Users can change their password. This may not work with ldap or proxy_auth
   * mechanisms.
   */
  readonly changePassword?: boolean;

  /**
   * Disallow group creation via the API. Useful when groups are provided via
   * LDAP.
   */
  readonly disallowGroupCreation?: boolean;

  /**
   * Users are allowed to create projects in their 'home:' namespace themselves.
   */
  readonly allowUsersCreateHomeProject?: boolean;

  /** Newly created projects have access disabled by default. */
  readonly defaultAccessDisabled?: boolean;

  /** Can users create accounts themselves? */
  readonly registration?: UserRegistration;

  /** The default issue tracker to be used */
  readonly defaultIssueTracker?: string;

  /** URL to the web interface */
  readonly webUiUrl?: URL;

  /**
   * Base URL of the published repositories.
   *
   * This url points to the root of the published repositories, all projects
   * appear underneath it as follows:
   * `${repositoryUrl}/Foo:/Subproj:/repository_name`
   */
  readonly repositoryUrl?: URL;

  readonly httpProxy?: URL;

  /**
   * A filter that specifies URLs that should be excluded from proxying.
   *
   * This should be a coma separated list like the environment variable
   * `NO_PROXY`, e.g.:
   * ```
   * NO_PROXY="*.foo.com,bar.org,.startup.io"
   * ```
   */
  readonly noProxyFilter?: string;

  /**
   * The OBS instance name.
   *
   * It is exposed as the `DISTURL` macro in each built rpm.
   */
  readonly name?: string;

  /**
   * EXPERIMENTAL: allows admins to use external package repositories in project
   * repositories.
   */
  readonly downloadOnDemand?: boolean;

  /**
   * Always create a signing key when a project is created and no parent project
   * has a key. Key removal is prohibited in that case.
   */
  readonly enforceProjectKeys?: boolean;

  /**
   * If the last package in a project is cleaned up via `sourceupdate=cleanup`,
   * delete the whole project too?
   */
  readonly cleanupEmptyProjects?: boolean;

  /**
   * When a user creates a new project by branching a package, disable
   * publishing for that project.
   *
   * The default is `true` to save disk space and bandwidth.
   */
  readonly disableBranchPublishing: boolean;

  /** URL prefix for one-click installation files (e.g.: software.opensuse.org) */
  readonly ympUrl?: URL;

  /** Default bugzilla instance for reporting bugs to bugowners */
  readonly bugzillaUrl?: URL;

  /** Email address to contact the admin of this OBS instance. */
  readonly adminEmail?: string;

  /** The webui theme */
  readonly theme?: string;

  /** Enables delete requests for branched projects after given number of days. */
  readonly autoCleanupAfterDays?: number;

  /** Load user's profile pictures from Gravatar */
  readonly gravatar?: boolean;

  /** Do not show the options to hide projects or packages. */
  readonly hidePrivateOptions?: boolean;

  /** Regular expression for projects that should be hidden */
  readonly unlistedProjectsFilter?: string;

  /**
   * The description that will appear in the project list explaining the
   * exclusion filter.
   */
  readonly unlistedProjectsFilterDescription?: string;

  /** Architectures for which this server can schedule builds. */
  readonly schedulers: Arch[];
}

export const enum UserRegistration {
  /** New user can register themselves */
  Allow = "allow",
  /** New users need approval after registration */
  Confirmation = "confirmation",
  /** Accounts can only be created by the admin */
  Deny = "deny"
}

/** official docs: https://build.opensuse.org/apidocs/configuration.rng */
interface ConfigurationApiReply {
  configuration: {
    title: string;
    description: string;
    anonymous?: ChoiceOption;
    change_password?: ChoiceOption;
    disallow_group_creation?: ChoiceOption;
    allow_user_to_create_home_project?: ChoiceOption;
    default_access_disabled?: ChoiceOption;
    registration?: UserRegistration;
    default_tracker?: string;
    download_url?: string;
    obs_url?: string;
    http_proxy?: string;
    no_proxy?: string;
    name?: string;
    download_on_demand?: ChoiceOption;
    enforce_project_keys?: ChoiceOption;
    cleanup_empty_projects?: ChoiceOption;
    disable_publish_for_branches?: ChoiceOption;
    ymp_url?: string;
    bugzilla_url?: string;
    admin_email?: string;
    theme?: string;
    cleanup_after_days?: string;
    gravatar?: ChoiceOption;
    hide_private_options?: ChoiceOption;
    unlisted_projects_filter?: string;
    unlisted_projects_filter_description?: string;
    schedulers: { arch: Arch[] };
  };
}

const constructUrlOpt = {
  construct: (u: string): URL => new URL(u)
};

/**
 * Fetch the publicly readable configuration of the OBS instance belonging to
 * `con`.
 */
export async function fetchConfiguration(
  con: Connection
): Promise<Configuration> {
  const confReply = await con.makeApiCall<ConfigurationApiReply>(
    "/configuration.xml"
  );

  return Object.freeze(
    withoutUndefinedMembers({
      title: confReply.configuration.title,
      description: confReply.configuration.description,
      anonymous: choiceToBoolean(confReply.configuration.anonymous),
      changePassword: choiceToBoolean(confReply.configuration.change_password),
      disallowGroupCreation: choiceToBoolean(
        confReply.configuration.disallow_group_creation
      ),
      allowUsersCreateHomeProject: choiceToBoolean(
        confReply.configuration.allow_user_to_create_home_project
      ),
      defaultAccessDisabled: choiceToBoolean(
        confReply.configuration.default_access_disabled
      ),
      registration: confReply.configuration.registration,
      defaultIssueTracker: confReply.configuration.default_tracker,
      webUiUrl: extractElementIfPresent(
        confReply.configuration,
        "obs_url",
        constructUrlOpt
      ),
      repositoryUrl: extractElementIfPresent(
        confReply.configuration,
        "download_url",
        constructUrlOpt
      ),
      httpProxy: extractElementIfPresent(
        confReply.configuration,
        "http_proxy",
        constructUrlOpt
      ),
      noProxyFilter: confReply.configuration.no_proxy,
      name: confReply.configuration.name,
      downloadOnDemand: choiceToBoolean(
        confReply.configuration.download_on_demand
      ),
      enforceProjectKeys: choiceToBoolean(
        confReply.configuration.enforce_project_keys
      ),
      cleanupEmptyProjects: choiceToBoolean(
        confReply.configuration.cleanup_empty_projects
      ),
      disableBranchPublishing:
        choiceToBoolean(confReply.configuration.disable_publish_for_branches) ??
        true,
      ympUrl: extractElementIfPresent(
        confReply.configuration,
        "ymp_url",
        constructUrlOpt
      ),
      bugzillaUrl: extractElementIfPresent(
        confReply.configuration,
        "bugzilla_url",
        constructUrlOpt
      ),
      adminEmail: confReply.configuration.admin_email,
      theme: confReply.configuration.theme,
      autoCleanupAfterDays: extractElementIfPresent(
        confReply.configuration,
        "cleanup_after_days",
        { construct: (days: string) => parseInt(days, 10) }
      ),
      gravatar: choiceToBoolean(confReply.configuration.gravatar),
      hidePrivateOptions: choiceToBoolean(
        confReply.configuration.hide_private_options
      ),
      unlistedProjectsFilter: confReply.configuration.unlisted_projects_filter,
      unlistedProjectsFilterDescription:
        confReply.configuration.unlisted_projects_filter_description,
      schedulers: confReply.configuration.schedulers.arch
    })
  );
}
