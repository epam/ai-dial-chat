#!/usr/bin/env node
/*
 * Prints the S0 browser-baseline tables from the harness output in
 * tmp/celebrations-baseline/<captureId>/ (results.json, per-cell metrics.json,
 * cycles.json) and writes <root>/artefacts.sha256, a shasum list of every
 * binary artefact, printing only that list's own digest. An existing
 * artefacts.sha256 is never rewritten with different content, and scenes
 * captured at different revisions or working-tree fingerprints are rejected.
 * Usage (repository root): node libs/celebrations/browser-tests/summarize-baseline.mjs <captureId>
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const SCENES = ['sleigh', 'gift-wrapping', 'cat'];
const captureId = process.argv[2];
if (!captureId) {
  console.error('Usage: summarize-baseline.mjs <captureId>');
  process.exit(2);
}
const root = join('tmp/celebrations-baseline', captureId);
const results = JSON.parse(readFileSync(join(root, 'results.json'), 'utf8'));

/* Captures from S1 on carry provenance per scene; the 1cfb11468 layout has
   one top-level record. */
const sceneEnvironments = SCENES.filter(
  (scene) => results[scene]?.environment,
).map((scene) => [scene, results[scene].environment]);
const identities = new Map(
  sceneEnvironments.map(([scene, { revision, fingerprint }]) => [
    scene,
    `${revision}/${fingerprint ?? 'clean'}`,
  ]),
);
if (new Set(identities.values()).size > 1) {
  console.error(
    `Mixed provenance in ${root}: ${[...identities]
      .map(([scene, identity]) => `${scene} at ${identity}`)
      .join(', ')}`,
  );
  process.exit(1);
}
const fixed = (value, digits = 1) =>
  value === null || value === undefined ? '—' : Number(value).toFixed(digits);
const kib = (bytes) => (bytes ? `${bytes.toLocaleString('en-US')} B` : '0');

const sampleAt = (cell, label) =>
  cell.samples.find((sample) => sample.label === label);
const state = (sample) => {
  if (!sample) return '—';
  if (!sample.layerPresent) return 'layer gone';
  const flags = Object.entries(sample.sceneState ?? {})
    .filter(
      ([key]) =>
        key !== 'data-halloween-scene' && key !== 'data-new-year-scene',
    )
    .map(([key, value]) => `${key.replace('data-', '')}=${value}`);
  if (sample.catActor) flags.push('actor');
  if (sample.catFallback) flags.push('fallback');
  return `${sample.layerElements} el, ${sample.layerSvgs} svg, ${sample.snapshotWrappers} copies${
    flags.length ? `; ${flags.join(' ')}` : ''
  }`;
};

const lines = [];
const out = (line = '') => lines.push(line);

out('## Environment');
out();
if (results.environment) {
  out('| Item | Value |');
  out('| --- | --- |');
  for (const [key, value] of Object.entries(results.environment))
    out(`| ${key} | ${value} |`);
  out();
}
if (sceneEnvironments.length) {
  const keys = [
    ...new Set(sceneEnvironments.flatMap(([, env]) => Object.keys(env))),
  ];
  out(`| Scene | ${keys.join(' | ')} |`);
  out(`| --- |${keys.map(() => ' --- |').join('')}`);
  for (const [scene, env] of sceneEnvironments)
    out(`| ${scene} | ${keys.map((key) => env[key] ?? '—').join(' | ')} |`);
  out();
}

for (const scene of SCENES) {
  const data = results[scene];
  if (!data) {
    out(`## ${scene}`);
    out();
    out('No results recorded.');
    out();
    continue;
  }
  out(`## ${scene}`);
  out();
  out(
    'Metrics pass (no screenshots or trace). Times are ms after the scene layer mounted.',
  );
  out();
  out(
    '| Cell | Ready | At 50% of `durationMs` | At end + 500 ms | Frames p50 / p95 / max ms | Long tasks | Player request | Anims at end + 500 | Heap after GC | Detached svg |',
  );
  out('| --- | ---: | --- | --- | --- | ---: | --- | ---: | ---: | ---: |');
  for (const [id, cell] of Object.entries(data.cells)) {
    const half = sampleAt(cell, '50%') ?? sampleAt(cell, 'cancel+500');
    const last = sampleAt(cell, 'end+500');
    const lottie = cell.requests.lottie[0];
    out(
      `| ${id} | ${fixed(cell.timing.readyAfterMountMs)} | ${state(half)} | ${state(last)} | ${fixed(cell.frames.p50FrameMs)} / ${fixed(cell.frames.p95FrameMs)} / ${fixed(cell.frames.maxFrameMs)} | ${cell.frames.longTaskCount ?? '—'} | ${
        lottie
          ? `${kib(lottie.responseBodySize)} at +${fixed(lottie.afterActivationMs, 0)} ms`
          : 'none'
      } | ${last?.animations ?? '—'} | ${kib(cell.resources.heapUsedBytes)} | ${cell.resources.detachedSvgNodes ?? '—'} |`,
    );
  }
  out();
  const special = Object.entries(data.cells).filter(
    ([, cell]) =>
      cell.controls.cancel || cell.controls.network !== 'unthrottled',
  );
  if (special.length) {
    out(`### ${scene}: cancellation and network cells, every capture point`);
    out();
    for (const [id, cell] of special) {
      out(
        `- **${id}**: pointerdown at ${fixed(cell.timing.pointerDownAfterMountMs, 0)} ms; renderer inserts at [${cell.timing.rendererInsertsAfterMountMs
          .map((time) => fixed(time, 0))
          .join(
            ', ',
          )}] ms; ready ${fixed(cell.timing.readyAfterMountMs, 0)} ms`,
      );
      for (const sample of cell.samples)
        out(
          `  - ${sample.label} (+${fixed(sample.t - cell.timing.mountedAt, 0)} ms): ${state(sample)}; ${sample.animations} animations`,
        );
    }
    out();
  }
  out(
    `### ${scene}: ${data.cycles.complete.cycles.length}+${data.cycles.cancel.cycles.length} cycles (desktop, LTR)`,
  );
  out();
  out(
    '| Mode | Layer elements per cycle (min–max) | Copies / copy nodes (max) | Animations (min–max) | After the last deadline + 500 ms | Heap after GC | Detached svg |',
  );
  out('| --- | --- | --- | --- | --- | ---: | ---: |');
  for (const mode of ['complete', 'cancel']) {
    const { cycles, final, resources } = data.cycles[mode];
    const range = (key) =>
      `${Math.min(...cycles.map((cycle) => cycle[key]))}–${Math.max(...cycles.map((cycle) => cycle[key]))}`;
    out(
      `| ${mode} | ${range('layerElements')} | ${Math.max(...cycles.map((c) => c.snapshotWrappers))} / ${Math.max(...cycles.map((c) => c.snapshotNodes))} | ${range('animations')} | ${state(final)}; ${final.animations} animations; ${final.snapshotNodes} copy nodes | ${kib(resources.heapUsedBytes)} | ${resources.detachedSvgNodes ?? '—'} |`,
    );
  }
  out();
}

const binaries = [];
const walk = (directory) => {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(png|zip)$/.test(name)) binaries.push(path);
  }
};
walk(root);
const manifest = binaries
  .map(
    (path) =>
      `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${relative(root, path)}`,
  )
  .join('\n');
const manifestPath = join(root, 'artefacts.sha256');
if (!existsSync(manifestPath)) writeFileSync(manifestPath, `${manifest}\n`);
else if (readFileSync(manifestPath, 'utf8') !== `${manifest}\n`) {
  console.error(
    `${manifestPath} is finalized and differs from the artefacts on disk; it was left unchanged`,
  );
  process.exit(1);
}
out('## Binary artefacts');
out();
out(
  `${binaries.length} files under \`${root}/\` (Git-ignored), listed in \`artefacts.sha256\` with SHA-256 \`${createHash('sha256').update(`${manifest}\n`).digest('hex')}\`. Verify with \`cd ${root} && shasum -a 256 -c --quiet artefacts.sha256\`.`,
);
console.log(lines.join('\n'));
