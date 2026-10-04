## Context

The user supplied a Grafana 12.0.1 export with 17 panels and 16 targets. Its source UID,
dashboard identity, and absolute dates belong to one installation. No credentials,
private URLs, IP addresses, or user data were found in the string inventory.

## Goals / Non-Goals

Publish a portable RED example without changing backend metrics or the supplied panel layout.
Do not include the original attachment, deploy to Grafana, or modify earlier examples.

## Decisions

- Use the existing Prometheus import input and datasource variable pattern. Clear dashboard
  IDs, reset revision, replace absolute dates with `now-6h` / `now`, and clear cached selections.
- Preserve namespace/job/route/method filters. They aggregate matching replicas; the in-flight
  metric lacks a route label and must say that it ignores Route.
- Keep completed transports as the RED population, including streams and every status.
  Correct the export's contradictory streaming description instead of changing query scope.
- Replace unconditional error zero-fill with a zero numerator derived from an existing total,
  divided by a positive denominator. Guard each quantile with the fraction in the 60s bucket.
- Summary cards and bar rankings query the selected range end. Keep neutral summary colors
  instead of exporting health thresholds. Preserve the 30s refresh.

## Risks / Trade-offs

- Secret-pattern scans can miss arbitrary prose → inspect every string category and check
  that source-specific identifiers and selected values are absent from the final JSON.
- Latencies mix ordinary and streaming transports → state the population explicitly; use
  dashboard 00 for separate transport classes.
- A range top-k can have more than ten historical members → describe that in its panel;
  instant bar rankings remain limited to ten.
- No app hooks, APIs, localization keys, direction styles, cache, flags, or dependencies are
  introduced. Grafana retains keyboard, tooltip, loading, error, and responsive behavior.

## Migration Plan

Import the new JSON and select an application Prometheus datasource. Existing dashboards
remain unchanged. Delete the imported dashboard or remove the example to roll back.
