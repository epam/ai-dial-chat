#!/usr/bin/env node
/*
 * Lists added diff lines that look like a UI-kit adoption case, grouped by
 * signal. It only finds candidates — every hit still has to be read in
 * context and checked against the kit API (see SKILL.md).
 *
 *   node .claude/skills/ui-kit-review/scan-diff.mjs              # working tree vs HEAD
 *   node .claude/skills/ui-kit-review/scan-diff.mjs --base origin/development
 *   node .claude/skills/ui-kit-review/scan-diff.mjs --pr 1234    # needs `gh`
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const KIT_CSS = 'node_modules/@epam/ai-dial-ui-kit/dist/index.css';

/* Legacy `Dial*` names that are not superseded components: data types, enums
   and the 1.0 components that still have no 2.0 replacement. */
const LEGACY_ALLOWLIST = new Set([
  'DialItemType',
  'DialFile',
  'DialFileNodeType',
  'DialPagination',
  'DialFileName',
  'DialInputPopup',
]);

/* Files whose custom typography is an accepted exception: the 404 hero numeral
   is larger than the kit's biggest step (`dial-display1-text`, 32/48). */
const TYPOGRAPHY_EXEMPT_PATHS = [/^apps\/chat\/src\/pages\/NotFound\//];

const SOURCE = 'source';
const SPEC = 'spec';

const SIGNALS = [
  {
    id: 'legacy-dial-component',
    scope: SOURCE,
    /* A JSX tag (not a `Promise<DialX>` generic) or a bare name inside a
       multi-line import list. */
    re: /(?:^|[\s({])<(Dial[A-Z]\w*)[\s/>]|^\s*(Dial[A-Z]\w*),?\s*$/,
    hint: '1.0 kit component — confirm a 2.0 replacement via MCP (searchEntity shows "Use instead")',
    skip: (line, match) =>
      LEGACY_ALLOWLIST.has(match[1] ?? match[2]) ||
      /DialFileManager|DialFoldersTree/.test(line),
  },
  {
    id: 'error-text-markup',
    scope: SOURCE,
    re: /dial-(tiny|caption)-text[^'"`]*\btext-error\b|\btext-error\b[^'"`]*dial-(tiny|caption)-text/,
    hint: 'hand-rolled ErrorText (`dial-tiny-text text-error`)',
  },
  {
    id: 'caption-text-markup',
    scope: SOURCE,
    re: /dial-tiny-text[^'"`]*\btext-secondary\b|\btext-secondary\b[^'"`]*dial-tiny-text/,
    hint: 'hand-rolled CaptionText (`dial-tiny-text text-secondary`) — skip if a *ClassName prop default',
  },
  {
    id: 'error-text-wiring',
    scope: SOURCE,
    re: /<(ErrorText|CaptionText)\b/,
    hint: 'no live-region role since kit 0.16 — needs id + aria-describedby, or a pre-mounted alert/status region',
    /* `announce` renders the kit's always-mounted LiveRegion around the text,
       and usually sits on a later line of the tag. */
    skip: (line, match, tag) => /\bannounce=/.test(tag),
  },
  {
    id: 'alert-role-assumption',
    scope: SPEC,
    re: /getByRole\(\s*['"]alert['"]|role:\s*['"]alert['"]/,
    hint: 'test may assume ErrorText/CaptionText renders role="alert"',
  },
  {
    id: 'live-region',
    scope: SOURCE,
    re: /role=["'](alert|status)["']|aria-live=/,
    hint: 'conditionally mounted live regions announce unreliably; check it is mounted before its text',
  },
  {
    id: 'raw-control',
    scope: SOURCE,
    re: /<(button|select|textarea|mark)\b|<input\b[^>]*type=["'](checkbox|radio|range)["']/,
    hint: 'raw control — Button/IconButton/LinkButton, Select, Textarea, Checkbox, Radio, Slider, Highlight',
  },
  {
    id: 'loading-placeholder',
    scope: SOURCE,
    re: /\banimate-(spin|pulse)\b/,
    hint: 'Spinner / Skeleton',
  },
  {
    id: 'hand-rolled-popover',
    scope: SOURCE,
    re: /addEventListener\(\s*['"](pointerdown|mousedown|keydown)['"]|getBoundingClientRect\(/,
    hint: 'outside-click / Escape / manual positioning — Dropdown (renderOverlay), Popup, InteractiveTooltip',
  },
  {
    id: 'widget-role',
    scope: SOURCE,
    re: /role=["'](tablist|tab|tooltip|switch|progressbar|meter|dialog|menu)["']/,
    hint: 'widget role on custom markup — Tabs, Tooltip, Switch, ProgressBar, Popup, Dropdown',
  },
  {
    id: 'inline-width-bar',
    scope: SOURCE,
    re: /style=\{\{\s*width:\s*`?\$?\{?[^}]*%/,
    hint: 'track/fill bar — ProgressBar (role is fixed to progressbar)',
  },
  {
    id: 'state-screen-layout',
    scope: SOURCE,
    re: /size-full[^'"`]*items-center[^'"`]*justify-center|justify-center[^'"`]*size-full/,
    hint: 'centred full-area state — StateScreen (full screen only) or NoDataContent / ErrorMessageNotification',
  },
  {
    id: 'notification-markup',
    scope: SOURCE,
    re: /rounded-xl[^'"`]*bg-layer-sunken[^'"`]*p-3|Icon(AlertTriangle|AlertCircle|InfoCircle)Filled/,
    hint: 'section-message look-alike — Notification / *MessageNotification',
  },
];

/* Typography must come from the kit's `dial-*-text` scale only. A value read
   through `var(--…)` is the caller-driven CSS-var channel and is left to the
   reviewer. */
const CUSTOM_TYPOGRAPHY_SIGNALS = [
  {
    id: 'custom-typography-class',
    test: (path) => /\.tsx?$/.test(path),
    re: /(?:^|[\s'"`:])((?:[a-z-]+:)*(?:text-(?:xs|sm|base|lg|[2-9]?xl|\[[\d.]+(?:px|rem|em)\])|font-(?:mono|serif|sans|thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])|leading-[\w[\].-]+|tracking-[\w[\].-]+))(?=$|[\s'"`!])/,
    hint: 'Tailwind size/weight/family/leading/tracking utility — use a kit `dial-*-text` class (`font-mono` → `dial-code-text`) (getEntityDetails("typography"))',
  },
  {
    id: 'custom-typography-style',
    test: (path) => /\.tsx?$/.test(path),
    /* A value, not a `fontFamily: string` field of a *Typography interface. */
    re: /\b(fontSize|lineHeight|fontWeight|fontFamily|letterSpacing)\s*:(?!\s*(?:string|number)\b)/,
    hint: 'inline typography style — use a kit `dial-*-text` class',
  },
  {
    id: 'custom-typography-css',
    test: (path) => /\.s?css$/.test(path),
    re: /^\s*(font-size|line-height|font-weight|letter-spacing|font-family|font)\s*:(?![^;]*var\(--)/,
    hint: 'typography declared in a stylesheet — only em-relative pseudo-element glyphs may do this, with a comment',
  },
  {
    id: 'redefined-kit-typography',
    test: (path) => /\.s?css$/.test(path),
    re: /\.dial-[a-z0-9-]+-text\b[^{]*\{/,
    hint: 'a local `.dial-*-text` rule shadows the kit scale and drifts on upgrade',
  },
  {
    id: 'typography-important',
    test: (path) => /\.s?css$/.test(path),
    re: /(font-size|line-height|font-weight|letter-spacing)\s*:[^;]*!important/,
    hint: '`!important` on typography overrides the class the caller passed',
  },
  {
    id: 'lead-text-double-case',
    test: (path) => /\.tsx?$/.test(path),
    re: /dial-[a-z]+-lead[a-z-]*-text[^'"`]*\b(uppercase|tracking-)|\b(uppercase|tracking-[\w[\].-]+)[^'"`]*dial-[a-z]+-lead[a-z-]*-text|-lead[a-z-]*-text[^\n]*\.toUpperCase\(/,
    hint: '`*-lead-*` classes uppercase and track themselves — drop `uppercase`/`tracking-*`/`.toUpperCase()`',
  },
];

const readKitTypography = () => {
  if (!existsSync(KIT_CSS)) {
    return null;
  }
  const css = readFileSync(KIT_CSS, 'utf8');
  return new Set(
    [...css.matchAll(/\.(dial-[a-z0-9-]+-text)\b/g)].map((m) => m[1]),
  );
};

const parseArgs = (argv) => {
  const args = { base: null, pr: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[(i += 1)];
    else if (argv[i] === '--pr') args.pr = argv[(i += 1)];
  }
  return args;
};

const readDiff = ({ base, pr }) => {
  const options = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  if (pr) {
    return execFileSync('gh', ['pr', 'diff', pr], options);
  }
  const range = base ? [`${base}...HEAD`] : ['HEAD'];
  return execFileSync('git', ['diff', '--unified=0', ...range], options);
};

const isReviewedFile = (path) =>
  /^(apps\/[^/]+|libs\/[^/]+)\/src\/.*\.(tsx?|s?css)$/.test(path) &&
  !/\/(dist|out-tsc)\//.test(path) &&
  !path.startsWith('apps/chat-api/');

const isSpecFile = (path) =>
  /\/tests\/|\.spec\.|\.stories\.|\/mocks\//.test(path);

const isCommentLine = (text) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(text);

/** Yields `{ path, line, text }` for every added line of a reviewed file. */
const addedLines = function* (diff) {
  let path = null;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const target = raw.slice(4).replace(/^b\//, '');
      path = target === '/dev/null' ? null : target;
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (path == null || !isReviewedFile(path)) continue;
    if (raw.startsWith('+')) {
      yield { path, line, text: raw.slice(1) };
      line += 1;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      line += 1;
    }
  }
};

/** Joins an added line with the consecutive added lines after it, up to the end of its JSX tag. */
const jsxTagText = (lines, index) => {
  const { path, line } = lines[index];
  let text = '';
  for (let i = index; i < lines.length && i < index + 12; i += 1) {
    const next = lines[i];
    if (next.path !== path || next.line !== line + (i - index)) break;
    text += `${next.text}\n`;
    if (/\/?>\s*$/.test(next.text)) break;
  }
  return text;
};

const scan = (diff, typography) => {
  const hits = new Map();
  const add = (id, hint, entry) => {
    if (!hits.has(id)) hits.set(id, { hint, entries: [] });
    hits.get(id).entries.push(entry);
  };

  const lines = [...addedLines(diff)];
  for (const [index, { path, line, text }] of lines.entries()) {
    if (isCommentLine(text)) continue;
    const isSpec = isSpecFile(path);
    const entry = `${path}:${line}  ${text.trim().slice(0, 140)}`;

    for (const signal of SIGNALS) {
      if ((signal.scope === SPEC) !== isSpec) continue;
      const match = text.match(signal.re);
      if (match && !signal.skip?.(text, match, jsxTagText(lines, index))) {
        add(signal.id, signal.hint, entry);
      }
    }

    if (isSpec) continue;

    const typographySignals = TYPOGRAPHY_EXEMPT_PATHS.some((re) =>
      re.test(path),
    )
      ? []
      : CUSTOM_TYPOGRAPHY_SIGNALS;
    for (const signal of typographySignals) {
      const match = signal.test(path) && text.match(signal.re);
      if (match) {
        add(
          signal.id,
          signal.hint,
          match[1] ? `${entry}  [${match[1]}]` : entry,
        );
      }
    }

    if (
      /<Icon[A-Z]\w*/.test(text) &&
      !/<Icon\w*Filled\b/.test(text) &&
      text.includes('/>') &&
      !/stroke=|\.\.\.BASE_/.test(text)
    ) {
      add(
        'icon-stroke',
        'Tabler icon without stroke={DIAL_KIT_ICON_STROKE} (filled glyphs and 48px+ empty-state art are exempt)',
        entry,
      );
    }

    if (typography) {
      for (const [, name] of text.matchAll(/\b(dial-[a-z0-9-]+-text)\b/g)) {
        if (!name.startsWith('dial-kit-') && !typography.has(name)) {
          add(
            'unknown-typography',
            'not a class in the installed kit CSS — it compiles to nothing (unless it is a lib-owned public class)',
            `${entry}  [${name}]`,
          );
        }
      }
    }
  }
  return hits;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const typography = readKitTypography();
  const hits = scan(readDiff(args), typography);

  if (typography == null) {
    console.log(`! ${KIT_CSS} not found — typography check skipped\n`);
  }
  if (hits.size === 0) {
    console.log('No UI-kit signals in the added lines.');
    return;
  }
  for (const [id, { hint, entries }] of hits) {
    console.log(`## ${id} (${entries.length}) — ${hint}`);
    for (const entry of entries) console.log(`  ${entry}`);
    console.log('');
  }
};

main();
