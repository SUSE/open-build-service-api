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

/**
 * This module contains utility functions to extract properties from arbitrary
 * data
 */

import * as assert from "assert";
import { spawn } from "child_process";
import { promises as fsPromises, Stats } from "fs";
import { join } from "path";
import { TypesEqual } from "./types";

export function zip<T, U>(arr1: T[], arr2: U[]): [T, U][];
export function zip<T, U>(arr1: T[], arr2: readonly U[]): readonly [T, U][];
export function zip<T, U>(arr1: readonly T[], arr2: U[]): readonly [T, U][];
export function zip<T, U>(
  arr1: readonly T[],
  arr2: readonly U[]
): readonly [T, U][];

/**
 * Convert two arrays into an array of Tuples.
 *
 * @return An array of tuples where the first element is the i-th element of
 *     `arr1` and the second the i-h element of `arr2`. If the arrays differ in
 *     length, then result is as long as the shortest of both.
 */
export function zip<T, U>(
  arr1: T[] | readonly T[],
  arr2: U[] | readonly U[]
): [T, U][] | readonly [T, U][] {
  const res: [T, U][] = [];
  for (let i = 0; i < Math.min(arr1.length, arr2.length); i++) {
    res.push([arr1[i], arr2[i]]);
  }
  return res;
}

/**
 * Call `callbackFn` on `arrayOrObj` the same way `map` does, but just calls
 * `callbackFn(arrayOrObj)` in the case that `arrayOrObj` is not an array.
 *
 * @param arrayOrObj  An arbitrary array of objects or a single object.
 * @param callbackFn A call back function that can be passed to
 *     `Array.prototype.map`.
 */
export function mapOrApply<T, U>(
  arrayOrObj: T | T[],
  callbackFn: (value: T, index: number, array: T[]) => U
): U[] {
  if (Array.isArray(arrayOrObj)) {
    return arrayOrObj.map(callbackFn);
  } else {
    return [callbackFn(arrayOrObj, 0, [arrayOrObj])];
  }
}

/**
 * Call `callbackFn` on `arrayOrObj` the same way `map` does, but just calls
 * `callbackFn(arrayOrObj)` in the case that `arrayOrObj` is not an array. If
 * `arrayOrObj` is undefined, then an empty array is returned.
 *
 * @param arrayOrObj  An arbitrary array of objects or a single object or
 *     undefined.
 * @param callbackFn  A call back function that can be passed to
 *     `Array.prototype.map`.
 */
export function mapOrApplyOptional<T, U>(
  arrayOrObjOrUndefined: T | T[] | undefined,
  callbackFn: (value: T, index: number, array: T[]) => U
): U[] {
  return arrayOrObjOrUndefined === undefined
    ? []
    : mapOrApply(arrayOrObjOrUndefined, callbackFn);
}

/** Returns an array starting at zero and ending at `end - 1` */
export function range(end: number): number[];
/** Returns an array starting at `start` and ending at `end - 1` */
export function range(start: number, end: number): number[];

export function range(startOrEnd: number, end?: number): number[] {
  return end === undefined
    ? [...Array(startOrEnd).keys()]
    : [...Array(end - startOrEnd).keys()].map((i) => i + startOrEnd);
}

/** Convert a Unix time stamp to a Date */
export function dateFromUnixTimeStamp(unixTime: string | number): Date {
  return new Date(
    (typeof unixTime === "string" ? parseInt(unixTime, 10) : unixTime) * 1000
  );
}

/** Convert a Date to a Unix time stamp */
export function unixTimeStampFromDate(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert a constructor or a construct function into a common construction
 * function.
 *
 * @param construct  A function taking some data and returning an instance of
 *     [[T]]. If this function is provided, then it is returned.
 * @param type  An implementation of [[T]] with a constructor.
 *
 * @return If both construct and type are undefined then the identity function
 *     is returned. If construct is defined, then construct is returned,
 *     otherwise a wrapper for the constructor of [[T]] is returned.
 */
function makeConstruct<T>(
  construct?: (data: any) => T,
  type?: new (data: any) => T
): (data: any) => T {
  if (construct === undefined && type === undefined) {
    return (data: any) => data as T;
  }
  if (construct !== undefined) {
    return construct;
  } else {
    assert(
      type !== undefined,
      "makeConstruct: type must not be undefined as construct is undefined"
    );
    return (data: any) => new type(data);
  }
}

export const isEmptyObj = (obj: any): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  Object.keys(obj).length === 0 && obj.constructor === Object;

/** Return type of [[withoutUndefinedMembers]] */
export type RetT<T> = TypesEqual<T, Partial<T>> extends true
  ? T | undefined
  : T;

/**
 * Returns a new object that contains only the elements of `obj` that are not
 * undefined. If all members of `obj` are `undefined`, then `undefined` is
 * returned.
 *
 * The return type is:
 * - `T | undefined` if all members of `T` are optional and thus `undefined`
 *   could be returned.
 * - `T` if `T` has at least one non-optional member (note that members of type
 *   `U|undefined` do not count as option!).
 */
export function withoutUndefinedMembers<T>(obj: T): RetT<T> {
  const res: any = {};

  Object.keys(obj).forEach((key) => {
    if ((obj[key as keyof T] as T[keyof T] | undefined) !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      res[key] = obj[key as keyof T];
    }
  });
  return (isEmptyObj(res) ? undefined : (res as T)) as RetT<T>;
}

/**
 * Returns a new object that contains only the members of `obj` that are not
 * undefined and that are arrays with more than 0 elements.
 */
export function deleteUndefinedAndEmptyMembers<T>(obj: T): T {
  const res: any = {};

  Object.keys(obj).forEach((key) => {
    const elem = obj[key as keyof T] as T[keyof T] | undefined;
    if (elem !== undefined) {
      if (!Array.isArray(elem) || ((elem as unknown) as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        res[key] = elem;
      }
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return res;
}

function extractPropertyFromObject<T>(
  data: any,
  key: string,
  {
    defaultValue,
    construct,
    type
  }: {
    defaultValue?: T;
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  } = {}
): T | undefined {
  assert(
    construct === undefined || type === undefined,
    "construct and type cannot both be defined"
  );

  if (!(key in data)) {
    return defaultValue === undefined ? undefined : defaultValue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return makeConstruct<T>(construct, type)(data[key]);
}

/**
 * Obtain an element from the object data with the given key.
 *
 * @return the obtained element if found or `undefined` otherwise.
 *
 * @param options  Can be used to pass the extracted element into a
 *     constructor. Either provide a class/type via the key `type` or a function
 *     that accepts the extracted data and returns a new object of type `T` via
 *     the key `construct`. Do **not** provide both at once.
 */
export function extractElementIfPresent<T>(
  data: any,
  key: string,
  options?: {
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  }
): T | undefined {
  return extractPropertyFromObject(data, key, options);
}

// Same as extractElementIfPresent, only it returns a default value instead of
// `undefined` if the element with the given key is not found in `data`.
export function extractElementOrDefault<T>(
  data: any,
  key: string,
  defaultValue: T,
  {
    construct,
    type
  }: {
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  } = {}
): T {
  return extractPropertyFromObject(data, key, {
    construct,
    defaultValue,
    type
  })!;
}

function extractPropertyFromObjectAsArray<T>(
  data: any,
  key: string,
  {
    defaultValue,
    construct,
    type
  }: {
    defaultValue?: T;
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  } = {}
): T[] | undefined {
  if (!(key in data)) {
    return defaultValue === undefined ? undefined : [defaultValue];
  }

  const constructF = makeConstruct<T>(construct, type);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!Array.isArray(data[key])) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return [constructF(data[key])];
  }

  const res: T[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  data[key].forEach((element: any) => {
    res.push(constructF(element));
  });
  return res;
}

/**
 * extract an array of elements with the given key
 *
 * @return undefined if the element is not present
 */
export function extractElementAsArrayIfPresent<T>(
  data: any,
  key: string,
  options?: {
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  }
): T[] | undefined {
  return extractPropertyFromObjectAsArray<T>(data, key, options);
}

/**
 * Extract an element with the given key from an object. If the key is not
 * present, then an empty array is returned.
 */
export function extractElementAsArray<T>(
  data: any,
  key: string,
  options?: {
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  }
): T[] {
  const res = extractPropertyFromObjectAsArray<T>(data, key, options);
  return res === undefined ? [] : res;
}

/** Type guard for distinguishing a [[ProcessError]]. */
export function isProcessError(err: Error): err is ProcessError {
  return (
    typeof (err as ProcessError).command === "string" &&
    (typeof (err as ProcessError).exitCode === "number" ||
      (err as ProcessError).exitCode === null)
  );
}

/** An Error class for a failed process execution. */
export class ProcessError extends Error {
  constructor(
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stdout: any[],
    public readonly stderr: any[]
  ) {
    super(
      (exitCode === null
        ? `${command} was killed by a signal`
        : `${command} exited with ${exitCode}`
      ).concat(`, got stderr: ${stderr.join("")}`)
    );
    assert(exitCode !== 0, "A ProcessError was created with zero exit code.");
  }
}

/**
 * Run the supplied command on system and resolve to its stdout.
 *
 * This function spawns a new process executing the given `command`. The
 * optional parameters can be used to set the process working directory, to feed
 * data into the processes via stdin and to set its `argv`.
 *
 * A promise is returned that resolves to the processes' stdout if it exits with
 * 0.
 *
 * @throw A [[ProcessError]] is thrown if the process returns a non-zero exit
 *     code.
 */
export function runProcess(
  command: string,
  {
    args,
    stdin,
    cwd,
    env
  }: {
    args?: readonly string[];
    stdin?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env });

    const stdout: any[] = [];
    const stderr: any[] = [];

    child.stdout.on("data", (data) => stdout.push(data));
    child.stderr.on("data", (data) => stderr.push(data));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.join(""));
      } else {
        reject(new ProcessError(command, code, stdout, stderr));
      }
    });
    child.on("error", (err) => reject(err));

    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/** Remove the directory `dir` and all its contents recursively */
export async function rmRf(dir: string): Promise<void> {
  const dentries = await fsPromises.readdir(dir, { withFileTypes: true });

  await Promise.all(
    dentries.map(async (dentry) => {
      if (dentry.isFile()) {
        await fsPromises.unlink(join(dir, dentry.name));
      } else if (dentry.isDirectory()) {
        await rmRf(join(dir, dentry.name));
      }
    })
  );
  await fsPromises.rmdir(dir);
}

/**
 * Copy the contents of `src` recursively to `dest`
 *
 * @param src  source directory which contents should be copied
 * @param dest destination to which everything from `src` is copied to. If it
 *     does not exist, then it is created (as are all directories leading to
 *     it). If this directory already exist, then it is not touched.
 */
export async function copyRecursive(src: string, dest: string): Promise<void> {
  const dentriesAndVoid = await Promise.all([
    fsPromises.readdir(src, { withFileTypes: true }),
    fsPromises.mkdir(dest, { recursive: true })
  ]);

  await Promise.all(
    dentriesAndVoid[0].map(async (dentry) => {
      const srcFullPath = join(src, dentry.name);
      const destFullPath = join(dest, dentry.name);
      if (dentry.isFile()) {
        await fsPromises.copyFile(srcFullPath, destFullPath);
      } else {
        await copyRecursive(srcFullPath, destFullPath);
      }
    })
  );
}

export const enum PathType {
  File,
  Directory
}

/**
 * Check if `path` exists and optionally if it is of the supplied `checkIsType`.
 *
 * @param path  The path which existence should be checked.
 * @param checkIsType  If provided, then `path` is checked whether it is of that
 *     type.
 *
 * @return The result of `fs.stat(path)` if the path exist (and if it is of the
 *     correct type), otherwise `undefined` is returned.
 */
export async function pathExists(
  path: string,
  checkIsType?: PathType
): Promise<Stats | undefined> {
  try {
    const stat = await fsPromises.stat(path);
    if (checkIsType === undefined) {
      return stat;
    }
    switch (checkIsType) {
      case PathType.File:
        return stat.isFile() ? stat : undefined;
      case PathType.Directory:
        return stat.isDirectory() ? stat : undefined;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Check that `path` is an empty directory or create it if it does not exist yet.
 *
 * @throw `Error` when `path` is not a directory or is a directory, but is not
 *     empty.
 */
export async function createOrEnsureEmptyDir(path: string): Promise<void> {
  const pathStat = await pathExists(path);
  if (pathStat === undefined) {
    await fsPromises.mkdir(path, { recursive: false });
  } else if (!pathStat.isDirectory()) {
    throw new Error(
      `cannot create the directory ${path}: already exists but is not a directory`
    );
  } else {
    const contents = await fsPromises.readdir(path);
    if (contents.length > 0) {
      throw new Error(
        `directory ${path} is not empty, the following file${
          contents.length > 1 ? "s" : ""
        } already exist: ${contents.join(",")}`
      );
    }
  }
}

/**
 * Remove the property with the given `key` from `obj` and return the result.
 */
export function dropProperty<T, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _drop, ...rest } = obj;
  return rest;
}

/**
 * Returns `undefined` if `obj` is `undefined`, otherwise the result of
 * `fn(obj)` is returned.
 */
export function undefinedIfNoInput<T, U>(
  obj: T | undefined,
  fn: (o: T) => U
): U | undefined {
  return obj === undefined ? undefined : fn(obj);
}

/** Sleep for `ms` milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dropUndefined<T>(arr: (T | undefined)[]): T[];
export function dropUndefined<T>(arr: readonly (T | undefined)[]): readonly T[];

/** Remove all elements from `arr` that are `undefined` */
export function dropUndefined<T>(
  arr: (T | undefined)[] | readonly (T | undefined)[]
): T[] | readonly T[] {
  return arr.filter((elem) => elem !== undefined) as T[];
}

export function strToInt(str: string, radix?: number): number {
  const res = parseInt(str, radix);
  if (isNaN(res)) {
    throw new Error(
      `could not parse ${str} as a number with radix ${radix ?? 10}`
    );
  }
  return res;
}
