// this module contains utility functions to extract properties from arbitrary
// data

"use strict";

import { assert } from "console";

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
    assert(type !== undefined);
    return (data: any) => new type!(data);
  }
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

// Obtain an element from the object data with the given key.
//
// Returns the obtained element if found or undefined otherwise.
//
// The options parameter can be used to pass the extracted element into a
// constructor. Either provide a class/type via the key `type` or a function
// that accepts the extracted data and returns a new object of type `T` via the
// key `construct`. Do **not** provide both at once.
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
