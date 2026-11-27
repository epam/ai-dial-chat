## [Celebrations S7] Batch 1 closed: SnowmanDelivery publication, local-stand rollback and accounting

Closes the three tasks batch 1 (`migrate-snowman-delivery-copy-track`, #9963) left open: the Themes publication (6.2), the deployed evidence and rollback (7.1) and the accounting (7.2). The evidence lives in the OpenSpec change `close-snowman-delivery-batch-1` (`evidence/publication.md`, `evidence/local-stand.md`, `evidence/accounting.md`). Nothing is rolled out; the compiled SnowmanDelivery stays the default and the fallback.

**Revisions.** Chat: batch 1 merge `2c6a8a83f` (counts), `22a7d662e` (local stand). Themes: `b170e2a` (`new-year-default@1.2.0`, index revision `2026-11-23.2`; asset sizes), `900b19a` (`1.5.1`, index revision `2026-11-25.3`; hashes and the stand).

### Publication

- [epam/ai-dial-chat-themes#186](https://redirect.github.com/epam/ai-dial-chat-themes/pull/186) (`d5e1775`) deleted `new-year-default@1.0.0`; [#187](https://redirect.github.com/epam/ai-dial-chat-themes/pull/187) (`b170e2a`) published `1.2.0` with `snowman-delivery`. Both merged on 2026-11-23. [#192](https://redirect.github.com/epam/ai-dial-chat-themes/pull/192), [#194](https://redirect.github.com/epam/ai-dial-chat-themes/pull/194) and [#197](https://redirect.github.com/epam/ai-dial-chat-themes/pull/197) carry the scene on in `1.3.0`, `1.4.0` and `1.5.1` (the default).
- The published files equal the Chat fixtures pinned in `copy-track-fixtures.spec.ts`, in `1.2.0` and in `1.5.1`:

| File | Bytes | sha256 |
| --- | ---: | --- |
| `snowman-delivery.desktop.e102fb11b63505f4.json` | 278,719 | `e102fb11b63505f431b2f77fb66438cc6f9374242ea23e5c16f16f19187988af` |
| `snowman-delivery.mobile.655cd2599ddb1964.json` | 286,910 | `655cd2599ddb1964fc6c97033ff3d4f6fcb9ed7ffbd676b598c2de5238568f10` |
| `snowman-delivery.poster.9a5fcf2229c5f6db.svg` | 4,362 | `9a5fcf2229c5f6db023c9c9f276f9acad5d961dbd8f46b79cd6ac1a4846dc1df` |

- Placement as published: `composer-anchor-v1`, scale 0.9 desktop / 0.68 mobile, `direction: none`, 25,000 ms playback, 27,500 ms lifetime.
- `node scripts/check-celebration-packs.mjs` on a clean extract of `900b19a`: valid, 0 warnings; its test file: 304/304.
- **Retention of `1.0.0`: a Themes-owner waiver.** The README rule ("no `index.json` revision from the last 30 days names it") was not met on 2026-11-23 under either reading: `bdd2feb` (2026-11-20) still listed `1.0.0`, and `defaults.new-year` last named it before `aafdbd2` (2026-11-18), so the window ended on 2026-12-18. The Themes owner merged #186 early; this comment records the waiver.

### Local-stand rollback

A **local stand, not a deployed environment**: Chat `22a7d662e` through its BFF, Themes `static/` with index revision `2026-11-25.3`, Chromium 1920 × 1080, LTR. The delivery policy came from environment variables (`prefer-external`, revision `1`, allowlist `gift-wrapping`, `snowman-delivery`, `santa-history-delivery`, `snow-circus`, `bullfinch-couriers`, `polar-bears-workshop`), because the managed configuration did not list SnowmanDelivery.

- **Recordings at normal speed:** `ledge-card` (the snowman borrows the first starter) and `platform` (starter row hidden, sled, no copied card), each a full 25 s scene of the external asset `new-year-default-snowman-delivery-desktop-e102fb11b63505f4`. The adapter did not choose `rim` on the start page; `platform` was accepted in its place.
- **Rollback during a `ledge-card` playback:** at 9.1 s the allowlist dropped `snowman-delivery` and the revision became `2` (`chat-api` restarted in 3.1 s); at 16.0 s a window `focus` refreshed the tab's client config; **the scene stopped at 16.1 s**, and the borrowed card was back in its slot.
- **After the rollback:** gift clicks drew only the remaining pool, and the 14th click in a fresh tab played the **compiled** SnowmanDelivery with no request for its external asset. Bullfinch couriers and polar bears stayed external, and the secret phrase played the **external** GiftWrapping. Santa and Snow Circus were not drawn, so they were not observed.
- **Capture note for S8:** Playwright's `page.screenshot()` re-applies the emulated viewport, and the anchored scene cancels on it as on a resize, on desktop too. Frames must come from `Page.captureScreenshot` over the DevTools protocol.

### Source and payload accounting

Counted by `count-celebrations-s7.mjs` (batch 0, part 2 of 8) with one map extension (below): at `2c6a8a83f` the published map's last entry, `['core', /./]`, would put the copy-track files in `runtime:core` silently. The extended script's output at `f585b223a` is byte-identical to the published one (184 / 34,832 / 33,599).

| Figure at `2c6a8a83f` | Files / physical / non-empty |
| --- | --- |
| SnowmanDelivery scene-specific | 9 / 3,266 / 3,147 (unchanged by #9963) |
| `interaction-copy-track-v1` adapter | 8 / 2,168 / 2,080 |
| Generic changes, counted once (`git diff dd37ad783 2c6a8a83f`) | 962 non-empty lines: borrowing 873, pack runtime 51, core 31, cat-borrow 7 |
| Total, S0 rule (before → after the merge) | 184 / 34,832 / 33,599 → 196 / 37,732 / 36,375 |

- Batch 1 design D14 gave SnowmanDelivery 3,241 / 3,123 at `f416f8c69`; the script gives 3,266 / 3,147 there. The difference is `new-year/types/new-year.ts` (25 / 24), which only SnowmanDelivery reaches.
- Adapter plus generic changes: 3,042 non-empty lines at the merge, against "about 2,437" in the batch 1 gate comment, which was measured on `f416f8c69` plus uncommitted work.
- `reindeer-text.ts` lost 188 lines to the generic `text-run-copy.ts`, so ReindeerTakeoff's own lines fell from 2,694 to 2,524 non-empty.
- Assets at Themes `b170e2a` (raw / gzip-9 / Brotli-11 bytes): desktop 278,719 / 32,288 / 23,909; mobile 286,910 / 33,844 / 24,909; poster 4,362 / 1,545 / 1,396.
- No net removal is claimed: the compiled scene stays until after the S8 window.

### Open for S8 (#9227)

A run in a deployed environment; rollback through Config Studio during playback; a `rim` recording; browser checks on mobile and desktop, LTR and RTL; contact frames; profiles; retention; preparation p95 under throttling; long-task recovery; a normal-speed parity review against the compiled scene; the pinned-player review in lottie-web 5.13.0.

<details><summary><code>count-celebrations-s7.mjs</code> as run (sha256 <code>6835af5b41bcc1a610784541b1620fdd365220cf684c9528ba3f7dd379e94ccb</code>; the batch 0 version is <code>72013acf663c23abbec41ac994504104922d65e539bbce27d124d6d2c23c09fa</code>). Command: <code>node count-celebrations-s7.mjs 2c6a8a83f --themes ../ai-dial-chat-themes --themes-rev b170e2a</code></summary>

Change against the batch 0 version: a new `adapter:copy-track` entry, and `copy-layers` and `text-run-copy` added to `borrow-generic`.

```js
#!/usr/bin/env node
/*
 * S7 (#9226) source and asset accounting for libs/celebrations at one revision.
 * Usage (ai-dial-chat repository root):
 *   node count-celebrations-s7.mjs <revision> --s0
 *   node count-celebrations-s7.mjs <revision> [--themes <path> --themes-rev <rev>]
 *
 * Files are read through `git ls-tree` / `git show`, so the working tree never
 * affects the result. The inclusion rule is S0's (celebration-migration-baseline):
 * .ts/.tsx/.scss/.css under libs/celebrations/src, excluding tests/, stories/,
 * test-utils/ segments, *.spec.*, *.stories.*, test-setup.ts and vite-env.d.ts.
 *
 * --s0 prints the S0 grouping (halloween / new-year / shared).
 *
 * Otherwise every included file gets exactly one bucket:
 * - scene:<id>     under halloween/ or new-year/ and reached, through relative
 *                  imports, from exactly one scene root
 * - event:<event>  under halloween/ or new-year/ and reached from several or no
 *                  scene roots (event shell, decoration, art shared by scenes)
 * - runtime:<part> any other file, by the explicit RUNTIME map below
 * - authoring      generators kept only to produce assets (AUTHORING, empty
 *                  while every generator is still a compiled fallback)
 * An unassigned file is an error, so the bucket totals always add up to the
 * S0-rule total. Assets (json/svg under src/**\/assets/ and, with --themes,
 * the published pack files) are reported in raw, gzip-9 and brotli-11 bytes.
 */
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = 'libs/celebrations/src';
const git = (args, cwd) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
const gitText = (args, cwd) => git(args, cwd).toString('utf8');

const isProduction = (relative) => {
  const parts = relative.split('/');
  const name = parts.at(-1);
  return (
    /\.(ts|tsx|scss|css)$/.test(name) &&
    !parts
      .slice(0, -1)
      .some((part) => ['tests', 'stories', 'test-utils'].includes(part)) &&
    !['test-setup.ts', 'vite-env.d.ts'].includes(name) &&
    !/\.(spec|stories)\./.test(name)
  );
};
const countLines = (text) => {
  /* A trailing newline ends the last line; it does not start a new one. */
  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n');
  return [lines.length, lines.filter((line) => line.trim()).length];
};

/* Scene roots: the component each scene id renders. */
const H = 'halloween/components/Halloween/';
const NY = 'new-year/components/';
const SCENE_ROOTS = {
  'halloween/spiders': `${H}HalloweenSpiderTheft.tsx`,
  'halloween/ghost': `${H}HalloweenGhosts.tsx`,
  'halloween/web': `${H}HalloweenWebScene.tsx`,
  'halloween/bats': `${H}HalloweenBats.tsx`,
  'halloween/cat': `${H}HalloweenCatScene.tsx`,
  'halloween/witches': `${H}HalloweenWitches.tsx`,
  'halloween/train': `${H}HalloweenTrain.tsx`,
  'halloween/portal': `${H}HalloweenPortal.tsx`,
  'halloween/ravens': `${H}HalloweenRavens.tsx`,
  'halloween/candy': `${H}HalloweenCandy.tsx`,
  'halloween/footprints': `${H}HalloweenFootprints.tsx`,
  'halloween/skeletons': `${H}HalloweenSkeletons.tsx`,
  'halloween/cauldron': `${H}HalloweenSecrets.tsx`,
  'halloween/mimic': `${H}HalloweenMimic.tsx`,
  'halloween/bowling': `${H}HalloweenBowling.tsx`,
  'halloween/mummy': `${H}HalloweenMummy.tsx`,
  'new-year/penguin-star': `${NY}NewYearPenguinStar/NewYearPenguinStar.tsx`,
  'new-year/gift-wrapping': `${NY}NewYearGiftWrapping/NewYearGiftWrapping.tsx`,
  'new-year/snowman-delivery': `${NY}NewYearSnowmanDelivery/NewYearSnowmanDelivery.tsx`,
  'new-year/reindeer-takeoff': `${NY}NewYearReindeerTakeoff/NewYearReindeerTakeoff.tsx`,
};

/* Files outside the event folders, by part. Order matters: first match wins. */
const RUNTIME = [
  [
    'adapter:composer-outline',
    /^(utils\/composer-outline-adapter|types\/composer-outline)\.ts$/,
  ],
  ['adapter:cat-borrow', /^(utils|constants|models|types)\/cat-borrow(-adapter)?\.ts$/],
  /* S7 batch 1 (#9963): the copy-track adapter and its generic copy modules. */
  [
    'adapter:copy-track',
    /^(utils\/copy-track-(adapter|markers|stages)|(constants|models|types)\/copy-track|models\/copy-track-(preparation|stage))\.ts$/,
  ],
  [
    'borrow-generic',
    /^(utils|models)\/(borrow-targets|lottie-markers|lottie-time-remap|lottie-track-keyframes|lottie-anchor-binding|copy-layers|text-run-copy)\.ts$/,
  ],
  [
    'pack-runtime',
    /^(components\/(LottieScene|StaticTriggerDecoration)\/|packs\/|hooks\/useLottieSceneSession|utils\/(lottie-player|lottie-scene-session|celebration-pack-scene|celebration-descriptor-event|celebration-variant|pack-scene-adapter|composer-anchor|composer-target|composer-watch)\.ts|models\/(celebration-pack|lottie-scene|lottie-composition)\.ts|types\/(celebration-pack|lottie-scene)\.ts|constants\/celebration-capabilities\.ts|hooks\/useComposerInterrupts\.ts)/,
  ],
  ['core', /./],
];
const AUTHORING = [];

const listFiles = (revision) =>
  gitText(['ls-tree', '-r', '--name-only', revision, ROOT])
    .split('\n')
    .filter(Boolean)
    .map((path) => path.slice(ROOT.length + 1));

const IMPORT =
  /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const resolveImport = (from, specifier, files) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(
    (candidate) => files.has(candidate),
  );
};

const revision = process.argv[2];
if (!revision) {
  console.error('Usage: count-celebrations-s7.mjs <revision> [--s0] [--themes <path> --themes-rev <rev>]');
  process.exit(2);
}
const flag = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const short = gitText(['rev-parse', '--short=9', revision]).trim();
const all = listFiles(revision);
const production = all.filter(isProduction);
const sources = new Map(
  production.map((file) => [file, gitText(['show', `${revision}:${ROOT}/${file}`])]),
);
const format = ([files, physical, nonEmpty]) =>
  `${files} / ${physical.toLocaleString('en-US')} / ${nonEmpty.toLocaleString('en-US')}`;
const add = (totals, key, file) => {
  const [physical, nonEmpty] = countLines(sources.get(file));
  const row = totals.get(key) ?? [0, 0, 0];
  totals.set(key, [row[0] + 1, row[1] + physical, row[2] + nonEmpty]);
};
const sum = (rows) =>
  rows.reduce((acc, row) => acc.map((value, i) => value + row[i]), [0, 0, 0]);

console.log(`revision ${short}`);
if (process.argv.includes('--s0')) {
  const totals = new Map();
  for (const file of production) {
    const first = file.split('/')[0];
    add(totals, first === 'halloween' || first === 'new-year' ? first : 'shared', file);
  }
  console.log('group      files / physical / non-empty');
  for (const group of ['halloween', 'new-year', 'shared'])
    console.log(`${group.padEnd(10)} ${format(totals.get(group) ?? [0, 0, 0])}`);
  console.log(`${'total'.padEnd(10)} ${format(sum([...totals.values()]))}`);
  process.exit(0);
}

/* Import graph over every file (production or not, so a .scss import counts). */
const fileSet = new Set(all);
const imports = new Map();
for (const [file, text] of sources) {
  const targets = new Set();
  for (const match of text.matchAll(IMPORT)) {
    const target = resolveImport(file, match[1] ?? match[2] ?? match[3], fileSet);
    if (target && sources.has(target)) targets.add(target);
  }
  imports.set(file, targets);
}
const reachedBy = new Map(production.map((file) => [file, new Set()]));
for (const [scene, root] of Object.entries(SCENE_ROOTS)) {
  if (!sources.has(root)) continue;
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    reachedBy.get(file).add(scene);
    stack.push(...imports.get(file));
  }
}

const bucketOf = new Map();
for (const file of production) {
  const first = file.split('/')[0];
  if (AUTHORING.includes(file)) bucketOf.set(file, 'authoring');
  else if (first === 'halloween' || first === 'new-year') {
    const scenes = [...reachedBy.get(file)].filter((scene) => scene.startsWith(`${first}/`));
    bucketOf.set(file, scenes.length === 1 ? `scene:${scenes[0]}` : `event:${first}`);
  } else {
    const match = RUNTIME.find(([, pattern]) => pattern.test(file));
    if (!match) {
      console.error(`unassigned: ${file}`);
      process.exit(1);
    }
    bucketOf.set(file, `runtime:${match[0]}`);
  }
}

const totals = new Map();
for (const file of production) add(totals, bucketOf.get(file), file);
const order = (key) =>
  ['scene:', 'event:', 'runtime:', 'authoring'].findIndex((prefix) => key.startsWith(prefix));
const keys = [...totals.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
console.log('bucket                               files / physical / non-empty');
for (const key of keys) console.log(`${key.padEnd(36)} ${format(totals.get(key))}`);
for (const prefix of ['scene:', 'event:', 'runtime:', 'authoring']) {
  const rows = keys.filter((key) => key.startsWith(prefix)).map((key) => totals.get(key));
  console.log(`${`subtotal ${prefix.replace(':', '')}`.padEnd(36)} ${format(sum(rows))}`);
}
console.log(`${'total (S0 rule)'.padEnd(36)} ${format(sum([...totals.values()]))}`);

/* Informational, not additive: event-folder files a scene reaches but shares. */
console.log('\nscene                                own physical / shared event files reached (physical)');
for (const scene of Object.keys(SCENE_ROOTS)) {
  const own = totals.get(`scene:${scene}`);
  if (!own) continue;
  const shared = production.filter(
    (file) =>
      bucketOf.get(file).startsWith('event:') && reachedBy.get(file).has(scene),
  );
  const sharedLines = shared.reduce((acc, file) => acc + countLines(sources.get(file))[0], 0);
  console.log(
    `${scene.padEnd(36)} ${own[1].toLocaleString('en-US')} / ${shared.length} files (${sharedLines.toLocaleString('en-US')})`,
  );
}

if (process.argv.includes('--files')) {
  console.log('\nfile-to-bucket map');
  for (const file of production) console.log(`${bucketOf.get(file)}\t${file}`);
}

const measure = (bytes) => [
  bytes.length,
  gzipSync(bytes, { level: 9 }).length,
  brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length,
];
const assetRow = (label, bytes) => {
  const [raw, gzip, brotli] = measure(bytes);
  console.log(`${label.padEnd(72)} ${raw} / ${gzip} / ${brotli}`);
};
console.log('\nassets                                                                   raw / gzip-9 / brotli-11 bytes');
for (const file of all.filter((path) => /(^|\/)assets\//.test(path)))
  assetRow(file, git(['show', `${revision}:${ROOT}/${file}`]));

const themes = flag('--themes');
const themesRev = flag('--themes-rev');
if (themes && themesRev) {
  const themesShort = gitText(['rev-parse', '--short=7', themesRev], themes).trim();
  console.log(`\npublished pack files at themes ${themesShort}`);
  for (const path of gitText(['ls-tree', '-r', '--name-only', themesRev, 'static/celebrations'], themes)
    .split('\n')
    .filter(Boolean))
    assetRow(path.replace('static/celebrations/', ''), git(['show', `${themesRev}:${path}`], themes));
}
```

</details>
