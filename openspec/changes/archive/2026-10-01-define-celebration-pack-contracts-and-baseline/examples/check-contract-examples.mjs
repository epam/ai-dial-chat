#!/usr/bin/env node
/*
 * Dev-only planning check for the S0 contract fixtures in ./fixtures. It applies
 * the v1 rules from specs/celebration-pack-contracts and
 * specs/celebration-lottie-authoring-profile to example files so a motion author
 * can see the contract is authorable. It is NOT the S2 publication validator or
 * the BFF validator: hashes are checked for format and internal consistency only,
 * because the example assets do not exist.
 *
 * Run from the repository root: node <evidence>/check-contract-examples.mjs
 * Exit 0 when every positive fixture is clean and every negative fixture reports
 * its expected rule.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const load = (name) => JSON.parse(readFileSync(join(fixtures, name), 'utf8'));

const enumValues = (file) =>
  [
    ...readFileSync(join('libs/celebrations/src', file), 'utf8').matchAll(
      /= '([a-z-]+)',/g,
    ),
  ].map(([, value]) => value);
/* Compiled events and their scene ids, read from the library enums. */
const KNOWN_EVENTS = {
  halloween: new Set(enumValues('halloween/types/halloween.ts').slice(0, 16)),
  'new-year': new Set(enumValues('new-year/types/new-year.ts')),
};

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ASSET_ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LABEL_ID = /^[a-z][A-Za-z0-9]{0,63}$/;
const REVISION = /^[A-Za-z0-9._-]{1,64}$/;
const CAPABILITIES = new Set([
  'lottie-light-svg-v1',
  'viewport-stage-v1',
  'composer-anchor-v1',
  'static-poster-v1',
  'static-trigger-v1',
]);
const MEDIA = {
  'application/json': 300 * 1024,
  'image/svg+xml': 100 * 1024,
  'image/png': 100 * 1024,
  'image/webp': 100 * 1024,
};
const EXCLUDED_KEYS = new Set([
  'script',
  'scripts',
  'function',
  'functions',
  'code',
  'css',
  'style',
  'styles',
  'stylesheet',
  'html',
  'font',
  'fonts',
  'selector',
  'selectors',
  'className',
  'classNames',
  'route',
  'routes',
  'url',
  'href',
  'src',
  'secretTrigger',
  'secretPhrase',
  'phrases',
  'decorBehaviors',
]);
const ALIGN = new Set([
  'center',
  'top',
  'bottom',
  'top-start',
  'top-end',
  'bottom-start',
  'bottom-end',
]);

const isInt = (value) => Number.isInteger(value);
const depth = (value) =>
  value && typeof value === 'object'
    ? 1 + Math.max(0, ...Object.values(value).map(depth))
    : 0;
const walk = (value, visit, path = '$') => {
  visit(value, path);
  if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value))
      walk(child, visit, `${path}.${key}`);
};

const report = () => {
  const findings = [];
  const add = (level, rule, message) =>
    findings.push({ level, rule, message });
  return {
    findings,
    error: (rule, message) => add('error', rule, message),
    warn: (rule, message) => add('warning', rule, message),
  };
};

/* Forbidden keys and absolute URLs anywhere in a manifest or catalog. */
const checkExcluded = (document, r) =>
  walk(document, (value, path) => {
    const key = path.split('.').at(-1);
    if (EXCLUDED_KEYS.has(key))
      r.error('excluded-field', `${path} is not allowed in v1`);
    if (
      typeof value === 'string' &&
      /^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/|(?:data|javascript|vbscript|blob):)/i.test(
        value,
      )
    )
      r.error('absolute-url', `${path} holds an absolute URL or scheme`);
  });

const checkRelativePath = (value, path, r) => {
  if (
    typeof value !== 'string' ||
    value.startsWith('/') ||
    value.split('/').includes('..') ||
    value.includes('\\')
  )
    r.error('path', `${path} must be a contained relative path`);
};

const checkAssetEntry = (assetId, entry, path, r) => {
  if (!ASSET_ID.test(assetId))
    r.error('id-format', `${path} asset id ${assetId}`);
  if (!SHA256.test(entry.sha256 ?? ''))
    r.error('hash-format', `${path}.sha256 must be 64 lowercase hex`);
  else if (!assetId.endsWith(entry.sha256.slice(0, 16)))
    r.error('hash-suffix', `${assetId} must end with its sha256 prefix`);
  const cap = MEDIA[entry.mediaType];
  if (cap === undefined)
    r.error('media-type', `${path}.mediaType ${entry.mediaType}`);
  else if (!isInt(entry.bytes) || entry.bytes <= 0 || entry.bytes > cap)
    r.error('caps', `${path}.bytes ${entry.bytes} exceeds ${cap}`);
};

const checkTiming = (scene, path, r) => {
  const { playbackDurationMs, loadTimeoutMs, readyTimeoutMs, maxLifetimeMs } =
    scene.timing ?? {};
  const values = [
    playbackDurationMs,
    loadTimeoutMs,
    readyTimeoutMs,
    maxLifetimeMs,
  ];
  if (!values.every((value) => isInt(value) && value > 0)) {
    r.error('timing', `${path}.timing needs four positive integers`);
    return;
  }
  if (loadTimeoutMs > 2000) r.error('timing', `${path} loadTimeoutMs > 2000`);
  if (readyTimeoutMs > 250) r.error('timing', `${path} readyTimeoutMs > 250`);
  if (maxLifetimeMs > 32000) r.error('timing', `${path} maxLifetimeMs > 32000`);
  if (maxLifetimeMs < loadTimeoutMs + readyTimeoutMs + playbackDurationMs)
    r.error(
      'timing',
      `${path} maxLifetimeMs < load + ready + playback (${maxLifetimeMs} < ${loadTimeoutMs + readyTimeoutMs + playbackDurationMs})`,
    );
  if (
    !isInt(scene.posterDurationMs) ||
    scene.posterDurationMs < 1000 ||
    scene.posterDurationMs > maxLifetimeMs
  )
    r.error('timing', `${path}.posterDurationMs outside 1000..maxLifetimeMs`);
};

const checkCapabilities = (list, path, r) => {
  for (const capability of list ?? [])
    if (capability.startsWith('interaction-'))
      r.warn(
        'capability-unsupported-v1',
        `${path}: ${capability} is reserved; v1 runtimes fall back`,
      );
    else if (!CAPABILITIES.has(capability))
      r.error('capability-unknown', `${path}: ${capability}`);
};

const checkPlacement = (placement, path, r) => {
  if (placement?.template === 'viewport-stage-v1') {
    if (!['contain', 'cover'].includes(placement.fit))
      r.error('placement', `${path}.fit`);
    if (!ALIGN.has(placement.align)) r.error('placement', `${path}.align`);
  } else if (placement?.template === 'composer-anchor-v1') {
    const { anchor, anchorRect, edge, scale, fallback } = placement;
    if (anchor !== 'composer') r.error('placement', `${path}.anchor`);
    if (
      !anchorRect ||
      !['x', 'y', 'width', 'height'].every((key) =>
        Number.isFinite(anchorRect[key]),
      )
    )
      r.error('placement', `${path}.anchorRect`);
    if (!['top', 'bottom'].includes(edge)) r.error('placement', `${path}.edge`);
    if (!(scale?.min >= 0.25 && scale.min <= scale.max && scale.max <= 4))
      r.error('placement', `${path}.scale`);
    if (!['viewport-stage-v1', 'poster'].includes(fallback))
      r.error('placement', `${path}.fallback`);
  } else r.error('placement', `${path}.template ${placement?.template}`);
};

const checkLabels = (labels, required, r) => {
  if (labels === undefined) {
    if (required) r.error('labels', 'external-only events need labels.en');
    return new Set();
  }
  if (!labels.en) r.error('labels', 'labels must include en');
  if (Object.keys(labels).length > 16) r.error('labels', 'more than 16 locales');
  const ids = new Set();
  for (const [locale, entries] of Object.entries(labels))
    for (const [id, text] of Object.entries(entries)) {
      ids.add(id);
      if (!LABEL_ID.test(id)) r.error('id-format', `label id ${id}`);
      if (typeof text !== 'string' || text.length > 280)
        r.error('labels', `${locale}.${id} must be ≤ 280 characters`);
      else if (text.replace(/\{\{phrase\}\}/g, '').includes('{{'))
        r.error('labels', `${locale}.${id} has a placeholder other than phrase`);
    }
  return ids;
};

export const checkManifest = (manifest, size) => {
  const r = report();
  checkExcluded(manifest, r);
  if (manifest.schemaVersion !== 1)
    r.error('schema-version', `schemaVersion ${manifest.schemaVersion}`);
  if (size > 64 * 1024) r.error('caps', `manifest ${size} B > 64 KiB`);
  if (depth(manifest) > 32) r.error('caps', 'manifest JSON depth > 32');
  for (const key of ['packId', 'eventId'])
    if (!ID.test(manifest[key] ?? '') || manifest[key].length > 64)
      r.error('id-format', `${key} ${manifest[key]}`);
  if (!VERSION.test(manifest.version ?? ''))
    r.error('id-format', `version ${manifest.version}`);
  checkCapabilities(manifest.requiredCapabilities, 'requiredCapabilities', r);

  const assets = new Map();
  if ((manifest.assets ?? []).length > 32) r.error('caps', 'more than 32 assets');
  for (const [index, entry] of (manifest.assets ?? []).entries()) {
    const path = `assets[${index}]`;
    if (assets.has(entry.assetId))
      r.error('duplicate-id', `asset ${entry.assetId}`);
    assets.set(entry.assetId, entry);
    checkAssetEntry(entry.assetId, entry, path, r);
    checkRelativePath(entry.file, `${path}.file`, r);
  }
  const reference = (assetId, path) => {
    if (!assets.has(assetId))
      r.error('asset-reference', `${path} → ${assetId} is not declared`);
  };

  const known = KNOWN_EVENTS[manifest.eventId];
  if (known && manifest.event)
    r.error(
      'known-event-event-block',
      `${manifest.eventId} is compiled; a pack cannot replace its trigger, pools or title`,
    );
  if (!known && !manifest.event)
    r.error('external-event-block-required', 'external-only event needs `event`');
  const labelIds = checkLabels(manifest.labels, !known, r);

  const sceneIds = new Set();
  if ((manifest.scenes ?? []).length > 16) r.error('caps', 'more than 16 scenes');
  for (const [index, scene] of (manifest.scenes ?? []).entries()) {
    const path = `scenes[${index}]`;
    if (!ID.test(scene.id ?? '')) r.error('id-format', `${path}.id`);
    if (sceneIds.has(scene.id)) r.error('duplicate-id', `scene ${scene.id}`);
    sceneIds.add(scene.id);
    if (known && !known.has(scene.id))
      r.error('scene-id-known', `${scene.id} is not a ${manifest.eventId} scene`);
    if (!LABEL_ID.test(scene.labelId ?? ''))
      r.error('id-format', `${path}.labelId`);
    if (!known && !labelIds.has(scene.labelId))
      r.error('labels', `${path}.labelId ${scene.labelId} has no label`);
    if (scene.renderer !== 'lottie-light-svg-v1')
      r.error('renderer', `${path}.renderer ${scene.renderer}`);
    checkCapabilities(scene.requiredCapabilities, `${path}.requiredCapabilities`, r);
    checkPlacement(scene.placement, `${path}.placement`, r);
    checkTiming(scene, path, r);
    reference(scene.posterAssetId, `${path}.posterAssetId`);
    const variants = scene.variants ?? [];
    if (variants.length < 1 || variants.length > 8)
      r.error('variants', `${path} needs 1–8 variants`);
    for (const [i, variant] of variants.entries()) {
      reference(variant.animationAssetId, `${path}.variants[${i}]`);
      const when = variant.when ?? {};
      for (const [key, value] of Object.entries(when))
        if (
          !(
            (key === 'layout' && ['mobile', 'desktop'].includes(value)) ||
            (key === 'direction' && ['ltr', 'rtl'].includes(value)) ||
            (key === 'colorScheme' && ['light', 'dark'].includes(value))
          )
        )
          r.error('variants', `${path}.variants[${i}].when.${key}`);
    }
    if (!['none', 'mirror', 'variant'].includes(scene.direction))
      r.error('direction', `${path}.direction ${scene.direction}`);
    if (
      scene.direction === 'variant' &&
      !variants.some(({ when }) => when?.direction === 'rtl')
    )
      r.error('direction', `${path} declares direction: variant without an rtl variant`);
  }
  if (manifest.event) {
    const { titleLabelId, clickSceneIds, iconAssetId, decoration } =
      manifest.event;
    if (!labelIds.has(titleLabelId)) r.error('labels', `event.titleLabelId`);
    if (!Array.isArray(clickSceneIds) || clickSceneIds.length === 0)
      r.error('event', 'event.clickSceneIds must list scenes');
    for (const id of clickSceneIds ?? [])
      if (!sceneIds.has(id)) r.error('event', `event.clickSceneIds → ${id}`);
    if (iconAssetId !== undefined) reference(iconAssetId, 'event.iconAssetId');
    if (decoration?.template !== 'static-trigger-v1')
      r.error('event', 'event.decoration.template must be static-trigger-v1');
    reference(decoration?.posterAssetId, 'event.decoration.posterAssetId');
    if (!labelIds.has(decoration?.labelId))
      r.error('labels', 'event.decoration.labelId has no label');
  }
  return {
    ...r,
    eventClass: known ? 'known-bundled' : 'external-only',
    assets,
  };
};

export const checkCatalog = (catalog) => {
  const r = report();
  checkExcluded(catalog, r);
  if (!Array.isArray(catalog.themes) || typeof catalog.images !== 'object')
    r.error('legacy-shape', 'themes[] and images{} are required');
  if (catalog.schemaVersion === undefined) return { ...r, legacy: true };
  if (catalog.schemaVersion !== 1)
    r.error('schema-version', `schemaVersion ${catalog.schemaVersion}`);
  if (!REVISION.test(catalog.revision ?? ''))
    r.error('id-format', `revision ${catalog.revision}`);
  const themes = new Set(catalog.themes.map(({ id }) => id));
  const assets = catalog.assets ?? {};
  for (const [assetId, entry] of Object.entries(assets)) {
    checkAssetEntry(assetId, entry, `assets.${assetId}`, r);
    checkRelativePath(entry.path, `assets.${assetId}.path`, r);
  }
  const packs = new Set();
  for (const [index, pack] of (catalog.celebrationPacks ?? []).entries()) {
    const path = `celebrationPacks[${index}]`;
    if (!ID.test(pack.packId ?? '') || !ID.test(pack.eventId ?? ''))
      r.error('id-format', `${path} ids`);
    if (!VERSION.test(pack.version ?? '')) r.error('id-format', `${path}.version`);
    checkRelativePath(pack.manifest?.path, `${path}.manifest.path`, r);
    if (!SHA256.test(pack.manifest?.sha256 ?? ''))
      r.error('hash-format', `${path}.manifest.sha256`);
    packs.add(`${pack.packId}@${pack.version}`);
  }
  /* Invalid references are dropped by the BFF, not fatal (appearance-override-contract). */
  const dropped = (message) => r.warn('dropped-reference', message);
  if (catalog.defaultThemeId !== undefined && !themes.has(catalog.defaultThemeId))
    dropped(`defaultThemeId ${catalog.defaultThemeId}`);
  for (const [scheme, id] of Object.entries(catalog.systemThemeIds ?? {}))
    if (!themes.has(id)) dropped(`systemThemeIds.${scheme} ${id}`);
  for (const theme of catalog.themes) {
    if (
      theme.colorScheme !== undefined &&
      !['light', 'dark'].includes(theme.colorScheme)
    )
      r.error('color-scheme', `${theme.id}.colorScheme ${theme.colorScheme}`);
    for (const [key, assetId] of Object.entries(theme.branding ?? {}))
      if (!(assetId in assets)) dropped(`${theme.id}.branding.${key} ${assetId}`);
    for (const [eventId, ref] of Object.entries(theme.celebrationPacks ?? {}))
      if (!packs.has(`${ref.packId}@${ref.version}`))
        dropped(`${theme.id}.celebrationPacks.${eventId} ${ref.packId}@${ref.version}`);
  }
  for (const [eventId, ref] of Object.entries(catalog.defaultCelebrationPacks ?? {}))
    if (!packs.has(`${ref.packId}@${ref.version}`))
      dropped(`defaultCelebrationPacks.${eventId} ${ref.packId}@${ref.version}`);
  return { ...r, legacy: false };
};

const ALLOWED_LAYERS = new Set([0, 3, 4]);
export const checkLottie = (animation, playbackDurationMs) => {
  const r = report();
  const [major, minor, patch] = String(animation.v ?? '').split('.').map(Number);
  if (
    major !== 5 ||
    !Number.isInteger(minor) ||
    minor > 13 ||
    (minor === 13 && patch > 0)
  )
    r.error('lottie-version', `v ${animation.v} is not 5.x ≤ 5.13.0`);
  const { fr, ip, op, w, h } = animation;
  if (!(fr >= 24 && fr <= 60)) r.error('lottie-structure', `fr ${fr}`);
  if (!(Number.isFinite(ip) && Number.isFinite(op) && ip >= 0 && ip < op))
    r.error('lottie-structure', 'ip/op');
  if (!(w >= 1 && w <= 4096 && h >= 1 && h <= 4096))
    r.error('lottie-structure', 'w/h');
  if (animation.ddd !== 0) r.error('lottie-excluded-feature', 'ddd must be 0');
  if (animation.fonts || animation.chars)
    r.error('lottie-excluded-feature', 'fonts/chars');
  if (depth(animation) > 64) r.error('caps', 'JSON depth > 64');
  const precomps = new Map(
    (animation.assets ?? []).map((asset) => [asset.id, asset]),
  );
  for (const asset of animation.assets ?? [])
    if (asset.u !== undefined || asset.p !== undefined)
      r.error('lottie-excluded-feature', `asset ${asset.id} references a file`);
  let layers = 0;
  let keyframes = 0;
  let vertices = 0;
  const visitLayers = (list, where) => {
    for (const layer of list ?? []) {
      layers++;
      if (!ALLOWED_LAYERS.has(layer.ty))
        r.error(
          'lottie-excluded-feature',
          `${where} layer "${layer.nm}" has type ${layer.ty}`,
        );
      if (layer.ty === 0 && !precomps.has(layer.refId))
        r.error('lottie-structure', `precomp ${layer.refId} missing`);
      if (layer.ef) r.error('lottie-excluded-feature', `${layer.nm} has effects`);
    }
  };
  visitLayers(animation.layers, 'root');
  for (const asset of precomps.values())
    if (asset.layers) visitLayers(asset.layers, `precomp ${asset.id}`);
  walk(animation, (value, path) => {
    const key = path.split('.').at(-1);
    if (key === 'x' && typeof value === 'string')
      r.error('lottie-excluded-feature', `${path} is an expression`);
    if (typeof value === 'string' && value.startsWith('data:'))
      r.error('lottie-excluded-feature', `${path} embeds a data URI`);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.a === 1 && Array.isArray(value.k)) keyframes += value.k.length;
      if (Array.isArray(value.v) && Array.isArray(value.i)) vertices += value.v.length;
    }
  });
  if (layers > 30) r.error('caps', `${layers} layers > 30`);
  if (keyframes > 2000) r.error('caps', `${keyframes} keyframes > 2000`);
  if (vertices > 8000) r.error('caps', `${vertices} vertices > 8000`);
  if (playbackDurationMs !== undefined && Number.isFinite(fr)) {
    const authored = ((op - ip) / fr) * 1000;
    if (Math.abs(authored - playbackDurationMs) > 1000 / fr)
      r.error(
        'timing',
        `composition lasts ${authored} ms, scene declares ${playbackDurationMs} ms`,
      );
  }
  return { ...r, layers, keyframes, vertices };
};

const FALLBACK = {
  'known-bundled':
    'before activation: bundled scene; before playback: poster (bundled only without side effects); after playback starts: restore and stop, no bundled replay in the same activation',
  'external-only':
    'before playback: poster or no-op; after playback starts: restore and stop; rollback: remove policy admission',
};

/* fixture → expected rule; `null` means the fixture must be clean. */
const CASES = [
  ['config.legacy.example.json', 'catalog', null],
  ['config.v1.example.json', 'catalog', null],
  ['manifest.sleigh.v1.example.json', 'manifest', null],
  ['manifest.company-anniversary.v1.example.json', 'manifest', null],
  ['lottie.minimal.v1.example.json', 'lottie', null],
  ['manifest.undeclared-asset.invalid.json', 'manifest', 'asset-reference'],
  ['manifest.event-on-known-event.invalid.json', 'manifest', 'known-event-event-block'],
  ['manifest.schema-v2.invalid.json', 'manifest', 'schema-version'],
  ['manifest.absolute-url.invalid.json', 'manifest', 'absolute-url'],
  ['manifest.script-css.invalid.json', 'manifest', 'excluded-field'],
  ['lottie.text-layer.invalid.json', 'lottie', 'lottie-excluded-feature'],
];

const main = () => {
  let failed = false;
  const sleigh = load('manifest.sleigh.v1.example.json');
  for (const [name, kind, expected] of CASES) {
    const document = load(name);
    const size = statSync(join(fixtures, name)).size;
    const result =
      kind === 'catalog'
        ? checkCatalog(document)
        : kind === 'manifest'
          ? checkManifest(document, size)
          : checkLottie(
              document,
              /* The example animation stands in for the sleigh desktop variant. */
              sleigh.scenes[0].timing.playbackDurationMs,
            );
    const errors = result.findings.filter(({ level }) => level === 'error');
    const warnings = result.findings.filter(({ level }) => level === 'warning');
    const ok = expected
      ? errors.some(({ rule }) => rule === expected)
      : errors.length === 0;
    failed ||= !ok;
    const detail =
      kind === 'manifest' && !expected
        ? ` [${result.eventClass}: ${FALLBACK[result.eventClass]}]`
        : kind === 'lottie' && !expected
          ? ` [${result.layers} layers, ${result.keyframes} keyframes, ${result.vertices} vertices]`
          : '';
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name}: ${
        expected ? `expected ${expected}` : 'expected clean'
      }${detail}`,
    );
    for (const { level, rule, message } of [...errors, ...warnings])
      console.log(`       ${level} ${rule}: ${message}`);
  }
  /* The catalog must point at the example manifest with its real size and hash. */
  const catalog = load('config.v1.example.json');
  const entry = catalog.celebrationPacks[0];
  const bytes = readFileSync(join(fixtures, 'manifest.sleigh.v1.example.json'));
  const matches =
    entry.packId === sleigh.packId &&
    entry.version === sleigh.version &&
    entry.eventId === sleigh.eventId &&
    entry.manifest.bytes === bytes.length &&
    entry.manifest.sha256 === createHash('sha256').update(bytes).digest('hex');
  console.log(
    `${matches ? 'ok  ' : 'FAIL'} catalog → manifest pointer matches packId, version, eventId, byte size and SHA-256`,
  );
  failed ||= !matches;
  process.exit(failed ? 1 : 0);
};

main();
