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

/**
 * Convert two arrays into an array of Tuples.
 *
 * @return An array of tuples where the first element is the i-th element of
 *     `arr1` and the second the i-h element of `arr2`. If the arrays differ in
 *     length, then result is as long as the shortest of both.
 */
export function zip<T, U>(
  arr1: T[] | ReadonlyArray<T>,
  arr2: U[] | ReadonlyArray<U>
): Array<[T, U]> {
  const res: Array<[T, U]> = [];
  for (let i = 0; i < Math.min(arr1.length, arr2.length); i++) {
    res.push([arr1[i], arr2[i]]);
  }
  return res;
}

/** Convert a UNIX time stamp to a Date */
export function dateFromUnixTimeStamp(unixTime: string | number): Date {
  return new Date(
    (typeof unixTime === "string" ? parseInt(unixTime, 10) : unixTime) * 1000
  );
}

/** Convert a Date to a UNIX time stamp */
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
    return (data: any) => data;
  }
  if (construct !== undefined) {
    return construct;
  } else {
    assert(
      type !== undefined,
      "makeConstruct: type must not be undefined as construct is undefined"
    );
    return (data: any) => new type!(data);
  }
}

/**
 * Sets a property of an object to `value` if `condition` is true, otherwise do
 * nothing.
 */
export function setPropertyOnCondition<T, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K],
  condition: boolean
): void {
  if (condition) {
    obj[key] = value;
  }
}

/**
 * Returns a new object that contains only the elements of `obj` that are not
 * undefined.
 */
export function deleteUndefinedMembers<T>(obj: T): T {
  const res: any = {};

  Object.keys(obj).forEach(key => {
    if (obj[key as keyof T] !== undefined) {
      res[key] = obj[key as keyof T];
    }
  });
  return res as T;
}

/**
 * Returns a new object that contains only the members of `obj` that are not
 * undefined and that are arrays with more than 0 elements.
 */
export function deleteUndefinedAndEmptyMembers<T>(obj: T): T {
  const res: any = {};

  Object.keys(obj).forEach(key => {
    const elem = obj[key as keyof T];
    if (elem !== undefined) {
      if (!Array.isArray(elem) || ((elem as unknown) as any[]).length > 0) {
        res[key] = elem;
      }
    }
  });
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
    default_value,
    construct,
    type
  }: {
    default_value?: T;
    construct?: (data: any) => T;
    type?: new (data: any) => T;
  } = {}
): T[] | undefined {
  if (!(key in data)) {
    return default_value === undefined ? undefined : [default_value];
  }

  const constructF = makeConstruct<T>(construct, type);

  if (!Array.isArray(data[key])) {
    return [constructF(data[key])];
  }

  const res: T[] = [];
  data[key].forEach((element: any) => {
    res.push(constructF(element));
  });
  return res;
}

// extract an array of elements with the given key
//
// Returns undefined if the element is not present
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

// Extract an element with the given key from an object. If the key is not
// present, then an empty array is returned.
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

// function getElementAsArrayOrDefaultMarkerIfPresent<IT, MT>(
//   type: { new (data: any): IT },
//   data: any,
//   key: string,
//   is_default: (...args: any[]) => boolean,
//   default_marker: MT
// ): Array<IT> | MT | undefined {
//   if (!(key in data)) {
//     return undefined;
//   }

//   if (is_default(data[key])) {
//     return default_marker;
//   }

//   if (!Array.isArray(data[key])) {
//     return [new type(data[key])];
//   }

//   const res: Array<IT> = [];
//   data[key].forEach((element: any) => {
//     res.push(new type(element));
//   });
//   return res;
// }
