# scheduled-tasks-consumer-fixture

This isolated Vite host installs scheduler, catalog, chat-hooks and their
workspace dependency closure as tarballs. It imports public UI, validation,
hook and CSS entries without source aliases or application providers.

```sh
npm exec nx run scheduled-tasks-consumer-fixture:test
```

The target builds and packs dependencies using the release manifest transform,
builds the host, checks its isolated strict TypeScript configuration, and runs
headless Chromium against the built host. Install Playwright Chromium if the
machine does not already have it.

Checks include runtime validation import, request preparation, trigger
description, responsive 3/2/1 columns, matching skeleton height, tertiary
form border, absence of global builder class leakage, instructions placeholder,
deployment selection, Browse and deletion close, and narrow form overflow.
UI Kit and other peer dependencies are provided by the host workspace.

For an already packed and built fixture, rerun only the acceptance checks:
`node tools/scheduled-tasks-consumer-fixture/scripts/verify.mjs`.

The browser check additionally injects conflicting host desktop utilities at
769px and 1280px, both before and after package CSS, in LTR and RTL. It verifies
Create-label visibility, exactly one detail title and action set, action placement
and form overflow at 360, 900, 1279, 1280 and 1920px.
