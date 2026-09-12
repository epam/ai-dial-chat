---
name: responsive-design
description: Responsive (mobile + desktop) layout workflow. Use whenever a UI change must work on both phones and desktops, when implementing Figma frames that have separate mobile and desktop variants, or when reviewing a change for mobile parity.
---

# Responsive design

## Overview

The chat app must render correctly on mobile (≤768px) and desktop (≥769px). Desktop is the historical baseline — most existing code is desktop-only. Treat **mobile-first** as the authoring default for new and changed UI: write the base classes for the smallest supported viewport and add desktop overrides via `desktop:`.

## Project breakpoints

Defined in `tailwind.config.js` (`extend.screens`) and inherited by all lib Tailwind configs via preset:

```js
// tailwind.config.js — extend.screens
mobile: { max: '768px' },   // ≤768 px  — phones and small tablets
desktop: { min: '769px' },  // ≥769 px  — tablets landscape, laptops, monitors
```

| Prefix        | Range   | When to use                          |
| ------------- | ------- | ------------------------------------ |
| _(no prefix)_ | always  | mobile-first base — smallest layout  |
| `mobile:`     | ≤768 px | overrides that apply **only** mobile |
| `desktop:`    | ≥769 px | overrides that kick in on desktop    |

**`desktop:` is a min-width prefix** — styles cascade upward to all wider viewports.

> **Do not use `small_tablet:`, `large_tablet:`, `large_desktop:`** — these prefixes are not in the config and Tailwind will silently ignore any class that uses them.
>
> **Do not use `sm:` / `md:` / `lg:` / `xl:`** — the default Tailwind breakpoints exist in the config (via `extend`) but are out of scope for this project and should not be used.

## When to use Tailwind prefixes vs. a JS hook

**Default: Tailwind utility prefixes.** They are SSR-safe, avoid first-paint flicker, and keep layout decisions in markup.

```tsx
<aside className="hidden desktop:block">…</aside>
<button className="h-12 mobile:h-14">…</button>
```

**Escape hatch: `useBreakpoint` / `useIsMobile`** from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts`. Reach for these only when:

- A component must mount entirely different subtrees per breakpoint (e.g. drawer vs. persistent sidebar) and a CSS-only `hidden`/`block` swap would still mount both
- An effect or imperative handler needs to branch on viewport size (focus, autoplay, virtualisation row count)
- A third-party component accepts a prop that toggles its mobile layout

Never call `window.matchMedia` directly inside components — go through the hook so the SSR fallback, listener cleanup, and breakpoint names stay consistent.

## Library Tailwind configs

`apps/chat/tailwind.config.js` presets the root config and so inherits the named breakpoints. The component libs (`libs/conversation-input`, `libs/conversation-messages`, and any future `libs/*` that ships Tailwind classes) **must also** `presets: [require('../../tailwind.config.js')]`:

```js
module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [join(__dirname, 'src/**/*.{ts,tsx}')],
};
```

### Why presetting matters

Libs build their own CSS in isolation (via `vite build` on the lib) and that CSS is what consumers may ultimately ship. Without the preset, an isolated lib build:

- compiles `mobile:` / `desktop:` as **unknown prefixes** and silently drops them — responsive utilities authored in the lib disappear from the emitted CSS;
- loses every project token (`bg-layer-1`, `text-primary`, the entire `controls-*` family, fonts, shadows) because those live on the root config's `theme` — classes referencing them fall back to Tailwind defaults, which means the lib ships visibly wrong colors in any context that does not also run the host app's Tailwind pass over the lib's source.

Re-declaring the theme inline per lib would duplicate ~150 lines of tokens and introduce silent drift the next time someone adds a colour to the root config. The preset keeps a single source of truth.

### Why this is allowed by `@nx/enforce-module-boundaries`

The `require('../../tailwind.config.js')` import crosses the Nx project boundary into the workspace root — exactly the kind of import the `@nx/enforce-module-boundaries` rule normally rejects. We do **not** punch a per-path `allow` hole for it. Instead, the rule is scoped in `eslint.config.mjs` to source files only (`**/src/**/*.{ts,tsx,js,jsx,…}`). Project-root build configs (`tailwind.config.js`, `vite.config.ts`, `eslint.config.mjs`) are workspace-level tooling, not application source code, so the boundary rule does not police them — which matches what that rule was designed to enforce. If you add a new lib that ships Tailwind classes, just author its `tailwind.config.js` with the same preset; no eslint changes are needed.

This tooling exception does not weaken source-code isolation. Hand-authored files under `libs/*/src`
must still avoid host-owned integration knowledge (API/server-api/generated-client/auth/session/env/
feature flags/routing/storage/analytics/telemetry/SDKs/platform bridges/etc.) and receive app
behavior through props, callbacks, or resolved values. `libs/chat-api-client/src/generated` is the
generated OpenAPI-client exception.

## Mobile-first authoring checklist

When implementing or modifying a component:

- [ ] Base classes describe the **mobile** layout — overrides target larger breakpoints
- [ ] Touch targets are at least 44×44 CSS px on mobile (use `mobile:` to bump a desktop-sized control when needed)
- [ ] No horizontal scroll at 360px width (test in DevTools device emulation)
- [ ] Long text wraps (`break-words` / `min-w-0` on flex children) rather than overflowing
- [ ] Modals, popovers, and dropdowns are reachable and dismissable on touch (no `:hover`-only affordances)
- [ ] Inputs use the correct `inputmode` / `type` so mobile keyboards show the right layout
- [ ] Sticky and fixed elements account for mobile browser chrome (`dvh`/`svh` over `vh` when relevant)
- [ ] Conditional layouts that swap components use `useBreakpoint`, not `window.innerWidth` reads
- [ ] If the change adds new strings, they fit at 360px without truncation in the supported locales

## Figma alignment

When a Figma file has separate mobile and desktop frames:

1. Fetch **both** frames in the design context call — never implement one without inspecting the other
2. If the design provides only desktop, ask before deriving a mobile version; do not guess
3. Map Figma's responsive frame sizes to the closest named breakpoint (375/390 → `mobile` ≤768px, 769+ → `desktop`)
4. Capture the divergences (drawer vs. sidebar, vertical vs. horizontal toolbar, hidden sections) before writing code; these drive whether you need the hook

## Verification

For any responsive change:

1. **DevTools** — exercise the feature at 360 (mobile) and 769, 1280, 1920 (desktop)
2. **Touch** — verify interactive elements work without hover (use the DevTools touch simulator)
3. **Unit tests** — when a component branches on `useBreakpoint`, add a test per branch by mocking the hook
4. **Lint / typecheck** — `npm exec nx lint chat`, `npm exec nx test chat` for the projects you touched
5. **Note in the PR** which breakpoints were exercised; a "verified desktop only" change is incomplete

## Running a responsiveness check with MCP Playwright

**Only run this when the user explicitly asks** ("check responsiveness", "verify mobile", "go over screens", etc.). Do not run it proactively after every UI change.

**Scope = what the user specifies.** If the user names a page or feature, check only that. If they say "current feature", limit scope to the components touched by the current branch. Do not audit the whole app unprompted.

The app at `http://localhost:4207` requires Keycloak auth — the MCP browser must log in before screenshots are useful.

### Setup

Playwright MCP is pre-configured in `.mcp.json` — no manual setup needed. It starts automatically with the project.

### Audit workflow

1. **Navigate** to `http://localhost:4207` — the browser window opens visibly (Chrome, headed by default)
2. **If redirected to Keycloak login**, tell the user: "A Chrome window opened — please log in so I can proceed", then wait with `mcp__playwright__browser_wait_for` (textGone: "Sign in to dial", time: 120)
3. **Navigate to the specific page/feature** the user asked about (or the one touched by the current branch)
4. **For each relevant viewport** — 360 and 768 for mobile, 769 and 1280 for desktop (add 1920 only if user asks):
   - `mcp__playwright__browser_resize` to set width × height
   - Screenshot the specific screen/component under review
   - Run `mcp__playwright__browser_evaluate` to detect horizontal overflow:
     ```js
     [...document.querySelectorAll('*')]
       .filter(
         (el) =>
           el.getBoundingClientRect().width >
           document.documentElement.clientWidth + 2,
       )
       .map((el) => ({
         tag: el.tagName,
         cls: el.className?.toString().slice(0, 60),
         w: Math.round(el.getBoundingClientRect().width),
       }))
       .slice(0, 10);
     ```
   - On mobile widths (≤768), also check touch targets:
     ```js
     [...document.querySelectorAll('button,a,[role="button"]')]
       .filter((el) => {
         const r = el.getBoundingClientRect();
         return r.width > 0 && (r.width < 44 || r.height < 44);
       })
       .map((el) => ({
         tag: el.tagName,
         text: el.textContent?.trim().slice(0, 30),
         w: Math.round(el.getBoundingClientRect().width),
         h: Math.round(el.getBoundingClientRect().height),
       }))
       .slice(0, 15);
     ```
5. **Check each screenshot** visually using the Read tool (it renders images inline)
6. **Report findings** grouped by viewport with screenshot paths

### Key things to look for

- Horizontal scroll at 360px
- Text overflow / clipping
- Touch targets < 44×44px on mobile
- Sidebar visible on desktop but missing toggle on mobile
- Fixed/sticky elements obscuring content on small screens
- Modals fitting within the viewport

## Anti-patterns

- `className={isMobile ? 'flex-col' : 'flex-row'}` — use `flex-col desktop:flex-row` instead
- Reading `window.innerWidth` in render or effects — use `useBreakpoint`
- Hiding mobile UI with `display:none` while still mounting heavy subtrees — branch with the hook
- Authoring desktop-first and then trying to reset on `mobile:` — invert it
- Using `sm:` / `md:` / `lg:` / `xl:` — they are not configured here
- Using `small_tablet:`, `large_tablet:`, or `large_desktop:` — these prefixes do not exist and are silently ignored by Tailwind
- Adding `min-[820px]:` arbitrary queries — use the named breakpoints in the root config instead
- Implementing a Figma desktop frame without checking whether a mobile variant exists
