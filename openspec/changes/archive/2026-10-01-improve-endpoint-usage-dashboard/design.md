## Context

User-provided Grafana evidence demonstrates that syntax/query checks did not catch presentation
defects. The deployment health endpoint reports Grafana 12.0.1. Existing count, filtering, and
fixed top-ten contracts remain authoritative; this revision improves presentation only.

## Goals / Non-Goals

**Goals:** Visible labels at realistic cardinality, full readable counts, compact useful layout,
and a rate chart that displays ordinary traffic alongside large spikes.

**Non-goals:** New metrics, backend changes, additional telemetry, or remote Grafana writes.

## Decisions

- Replace the area bar gauges with a native sortable table containing Area, Requests (estimated),
  and Share. Text cells keep area names visible when there are many categories; an inline share
  gauge is supplementary. Reuse the existing area aggregation for both count and share.
- Use locale-separated whole-number formatting for request estimates, retaining estimate labels
  and documenting rounding. Do not round the underlying queries or change count populations.
- Keep the endpoint table full width; place top-ten counts and the smaller area table together,
  followed by a full-width trend. Shorten the scope note; keep measurement limits in descriptions.
- Use manual bar sizing for the ten endpoint labels and a neutral bar color. Use the native
  symmetric logarithmic scale (base 10, linear below 1 req/min) for the rate graph. Unlike a
  hard Y maximum this keeps the spike visible; unlike a pure log scale it supports zero.
  Explicitly name the scale in the panel title and retain actual values in tooltips.
- Grafana owns filter state, rendering, keyboard controls, and responsive stacking. No React
  context, i18n key, direction-specific style, feature flag, cache, or app endpoint changes.

The [Grafana bar-gauge options](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/bar-gauge/)
document that min/max row heights apply only to manual sizing. The
[12.0.1 scale schema](https://github.com/grafana/grafana/blob/v12.0.1/packages/grafana-schema/src/common/common.gen.ts)
defines `symlog`, `log`, and `linearThreshold`.

## Risks / Trade-offs

- Logarithmic distances differ from linear distances → label the scale; tooltips show actual rates.
- Rounded estimates can look exact → preserve estimate labels and describe presentation rounding.
- A mock source cannot establish live counts → use it for real Grafana rendering only; validate
  query semantics separately with Prometheus fixtures. Never describe it as production evidence.
- Native table scrolling on narrow screens → validate the dashboard layout without adding custom CSS.

## Migration Plan

Reimport the updated JSON into the existing dashboard; select its existing UID in the import UI
to update rather than duplicate it. Keep portable `uid: null` in the repository. No backend rollout.
The archived first revision remains historical evidence; this is a separate OpenSpec change.

## Visual evidence

[Dashboard preview](evidence/endpoint-usage-preview.png) shows the revised dashboard in local
Grafana 12.0.1 at 1280 px with synthetic traffic. The preview establishes rendering only;
production counts and deployment are outside this evidence. The table scrolls horizontally
when its columns exceed the available panel width.
