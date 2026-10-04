# Verification

- Inspected the source export's string inventory. No credentials, private URLs, IP addresses,
  email addresses, user records, or stored metric samples were found.
- Removed dashboard ID/UID, fixed datasource references, absolute dates, and cached selections.
  Verified the source UID, datasource binding, and timestamps do not occur in the final JSON.
  The original attachment is not included in the repository.
- Verified all 33 Prometheus datasource references use the selectable variable. All 17 panel
  IDs, types, and grid positions are preserved; existing examples 00–06 are unchanged.
- Prometheus promtool 3.5.0 passed 128 expression assertions across eight synthetic scenarios:
  traffic with two replicas, traffic without error series, idle counters, absent series,
  an absent namespace, route filtering with the in-flight exception, quantiles beyond 60s,
  and normalized `60.0` bucket labels. Numeric comparisons use six decimal places to avoid
  floating-point aggregation noise; the dashboard expressions are not rounded.
- Imported the JSON through Grafana 12.0.1's import API in an isolated container without
  external networking or published ports. The datasource input resolved to the chosen test
  source and all 17 panels were saved. This verifies import, not a new browser layout review.
- Documentation validation, strict OpenSpec validation, Prettier, and diff checks passed.
  No app code or dependencies changed, so app builds and unit suites were not run.
- Removed both temporary verification containers. No production Grafana was modified.
