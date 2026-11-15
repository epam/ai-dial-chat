## Context

The path rule is the first of two guards on a custom-api destination. The second,
`resolveCustomApiDestination`, appends the configured path to `DIAL_CORE_URL`, re-parses the result and refuses
it unless origin, pathname, query and fragment are exactly what was intended. The rule excluded dots entirely,
which also excluded every DIAL application id.

## Decisions

**Allow `.` inside a segment, reject a `.` or `..` segment.** The WHATWG URL parser resolves only those two dot
forms and their percent-encoded spellings; percent signs are already outside the alphabet. Any other segment
with dots (`runner__1.0.0`, `.well-known`, `...`) is kept verbatim by the parser, so the configured path and the
dispatched path stay identical. The pattern is
`^(?:\/(?!\.\.?(?:\/|$))[A-Za-z0-9_.-]+)+$`: a slash, then a segment that is not exactly `.` or `..`.

**Keep the destination check as it is.** It already compares the resolved pathname with the configured one, so a
dot segment that ever slipped past the pattern would still fail before dispatch; a test now pins that.

Considered: allowing dots only in a `<name>__<version>` shape. Rejected: it ties the BFF to DIAL's id format
without adding safety, since the dot segments are what the parser acts on.

## Risks / Trade-offs

- A deployment can now configure a path to any application's route. That is a Core path like any other: Core
  still authorizes the caller's token against the route, and the registry stays deployment-owned.
