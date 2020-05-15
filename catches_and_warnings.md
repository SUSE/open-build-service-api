# Catches

- OBS and `osc` store timestamps in seconds since the beginning of the Unix
  epoch. This means that we **must** ensure that all modification dates are
  always rounded down to a second as otherwise we'll get different timestamps
  when creating files locally.
  Ensure this by using [[unixTimeStampFromDate]] to convert `Date` objects to
  Unix time.
