# Catches

- OBS and `osc` store timestamps in seconds since the beginning of the Unix
  epoch. This means that we **must** ensure that all modification dates are
  always rounded down to a second as otherwise we'll get different timestamps
  when creating files locally.
  Ensure this by using [[unixTimeStampFromDate]] to convert `Date` objects to
  Unix time.


# XML handling

There are multiple peculiarities with respect to the handling of XML objects,
partially due to the way we use
[xml2js'](https://github.com/Leonidas-from-XIV/node-xml2js) parser.

1. `explicitArray` is set to `false`. This has the advantage that XML elements
   that appear only once are not automatically converted to an
   array. Unfortunately, it also has the disadvantage that the following XML
   object:
```xml
<directory>
  <!-- usually we have multiple entries -->
  <entry name="bar"/>
</directory>
```
  will be converted to:
```js
{ directory: { entry: {$: {name: "bar" } } } }
```
  and not to:
```js
{ directory: { entry: [{$: {name: "bar" } }] } }
```

  This can lead to pretty nasty bugs, as they tend to not show up in tests (one
  usually does not test single element arrays…). Therefore we should move to
  `explicitArray: true` in the future as that should be more robust. In the
  meantime use the [[mapOrApply]] function instead of `map()` on array entries.

2. Completely optional attributes.
  If a XML element has completely optional attributes (i.e. it can appear as
  `<foo/>`), then such an element will **not** have the `$` attribute once
  serialized.
  Thus the type of such an element is not:
```typescript
interface Foo {
  $: {
    name?: string
  }
}
```
  but instead:
```typescript
interface Foo {
  $?: {
    name?: string
  }
}
```
  (`$` must be marked as optional as well).
