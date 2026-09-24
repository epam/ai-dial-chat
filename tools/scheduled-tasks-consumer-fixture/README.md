# scheduled-tasks-consumer-fixture

This isolated Vite host installs scheduler, catalog, chat-hooks, skills and their
workspace dependency closure as tarballs. It imports public UI, validation,
hook and CSS entries without source aliases or application providers.

```sh
npm exec -- nx run scheduled-tasks-consumer-fixture:test
```

The target builds and packs dependencies using the release manifest transform,
checks that package entries resolve to installed tarballs, imports the validation
entry at runtime, and checks the isolated strict TypeScript configuration. It
runs with the workspace test suite without requiring a browser.

The separate browser target builds the Vite host and uses Playwright Chromium
for favorites, catalog selection, removal, detail rendering, and focus restoration.
It checks 360px, 900px, 1280px, and 1920px layouts in LTR and RTL.
It runs in the PR workflow's browser job, which installs Chromium first:

```sh
npm exec -- playwright install chromium
npm exec -- nx run scheduled-tasks-consumer-fixture:test-browser
```

For an already packed fixture, rerun only these checks:

```sh
node tools/scheduled-tasks-consumer-fixture/scripts/verify-package.mjs
```

The Vite host remains available for build and manual integration checks:

```sh
npm exec -- nx run scheduled-tasks-consumer-fixture:build
```

UI Kit and other peer dependencies are provided by the host workspace.
The fixture checks skill-only preparation/hydration, explicit removal, focus
restoration, long references, RTL and 360px layout in Chromium. Application
scenarios belong in the separate e2e suite.
