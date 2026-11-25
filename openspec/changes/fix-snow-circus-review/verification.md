# Verification — 2026-11-25

All three local review findings are addressed: viewport-safe contact motion, eligibility before pair ranking, and accurate standard-pack documentation.

- Chat: 60 tests passed across button-props adapter, cat-borrow adapter, native fixtures and event routing. Scoped celebrations typecheck/lint passed (3 Nx tasks including dependencies).
- Browser: the four Snow Circus tests passed. Matrix: 360/900 mobile borrow one copy, 1280 RTL/1920 desktop borrow two, missing targets/reduced motion borrow none. Cancellation and repeated replay clean up copies. The new 360px right-edge regression keeps visible artwork inside the viewport at return and leaves the real button visible.
- Native envelope: 478 sampled contact frames, no violations of the authored [90,160]–[392,350] rectangle. Observed artwork bounds: [97.259,172.535]–[386.503,340.068]. Both native variants equal their pre-fix sources after removing the two bounds nulls: no art or choreography changes.
- Themes: publication checker passed with zero warnings; 17 focused Snow Circus/standard New Year checker tests passed. Source/pack/inventory hashes agree. Published versions 1.2.0–1.4.0 remain untouched; candidate 1.5.0 is unpublished.
- Budgets: each animation 145363 bytes, 35 layers, 1120 keys, 108 paths, 215 vertices, 26 seconds. Poster 10753 bytes. Browser profile: p95 frame interval 16.7ms, no recorded long tasks. This is headless Chromium evidence, not a physical-phone benchmark.
- Documentation validation passed. Main spec validation: 480 specs, zero errors, 204 existing reference warnings. Strict change validation passed. Both repositories pass git diff --check.
- Actual local Chat/API/Themes integration passed after API restart: standard new-year-default@1.5.0 contains six external scenes; gift selects bears and happy new year selects Snow Circus in the isolated deterministic browser fixture. New asset ab5df71a0fbf1225 was served; one borrowed copy, one player, no page errors and zero leftover copies after Escape. Identity/model data were browser fixtures; catalog and scene assets came from the real local API. No Core or Studio writes.

Checks were scoped to these fixes. Earlier full-workspace failures recorded for the original scene change were not rerun; this evidence does not assert that the entire workspace test suite is green.

## Immutable browser cache recovery — 2026-11-25

The earlier fresh-browser integration check did not cover an existing user's immutable HTTP cache. Logs confirmed that the user's cached 1.5.0 descriptor requested the removed dd0ad55212653b88 animation and received 404. Replaced the unpublished local preview with candidate 1.5.1, catalog revision 2026-11-25.3 and local delivery revision local-new-year-standard-1-5-1. Updated current documentation and checker retention expectations; published 1.2.0–1.4.0 and native animation bytes are unchanged.

A Chromium probe without request interception cached an old 1.5.0 descriptor, reloaded, and verified that a second fetch reused it without another server request. Resolving the real local catalog then fetched /packs/new-year-default/1.5.1 and the current ab5df71a0fbf1225 animation: both 200, native bounds present. Evidence: tmp/snow-circus/standard/cache-recovery.json. The separate real Chat/API integration probe passed with default 1.5.1, six scenes, one borrowed copy and player, no page errors and no copies after cancellation.

Themes publication/source checks passed, all 17 focused tests passed, documentation validation passed, strict OpenSpec validation and both git diff --check checks passed. No production caching behavior was changed.
