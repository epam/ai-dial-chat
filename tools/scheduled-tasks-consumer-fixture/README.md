# scheduled-tasks-consumer-fixture

This isolated Vite host installs scheduler, catalog, chat-hooks and their
workspace dependency closure as tarballs. It imports public UI, validation,
hook and CSS entries without source aliases or application providers.

```sh
npm exec nx run scheduled-tasks-consumer-fixture:test
```

The target builds and packs dependencies using the release manifest transform,
checks runtime imports and the isolated strict TypeScript configuration. It runs
with the workspace test suite and does not require a browser.

For browser acceptance checks, build the host and run headless Chromium:

```sh
npm exec playwright install -- --with-deps chromium
npm exec nx run scheduled-tasks-consumer-fixture:test-browser
```

CI runs `test-browser` in the packed browser consumers job after installing
Chromium and its system dependencies.

Checks include runtime validation import, request preparation, trigger
description, responsive 3/2/1 columns, matching skeleton height, tertiary
form border, absence of global builder class leakage, instructions placeholder,
deployment selection, Browse and deletion close, custom panel/sheet composition
at mobile and desktop widths with keyboard focus restoration, and narrow form overflow.
UI Kit and other peer dependencies are provided by the host workspace.

For an already packed and built fixture, rerun only the acceptance checks:
`node tools/scheduled-tasks-consumer-fixture/scripts/verify.mjs`.

The browser check additionally injects conflicting host desktop utilities at
769px and 1280px, both before and after package CSS, in LTR and RTL. It verifies
Create-label visibility, exactly one detail title and action set, action placement
and form overflow at 360, 900, 1279, 1280 and 1920px.
