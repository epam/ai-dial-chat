# Tasks

Slicing strategy: **contract-first, then vertical.** Slice 1 fixes the `1.1.0` artifact and pins it once, because the hash is frozen after the first upload (prompt 13) and every later slice validates against it. Slices 2–4 each take one runtime path through registry → snapshot → client-config, with its tests and docs. Slice 5 writes the editor guide, and slice 6 checks the whole change once. Before editing, read `apps/chat-api/AGENTS.md` and `.claude/rules/docs.md`. No `libs/*` source changes in this change.

## 1. Contract: the `1.1.0` artifact

- [x] 1.1 Move the celebration ID rules into one definition.
  - Export from `apps/chat-api/src/app-config/types/celebration-delivery.ts`:
    - the event pattern `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`;
    - the scene-pair pattern with its 64-character lookaheads;
    - the revision pattern `^[A-Za-z0-9._-]{1,64}$`;
    - the 64-character ID limit and the 64-entry list limit, as string pattern sources and numbers.
  - Make `apps/chat-api/src/config/environment.config.ts` build its `RegExp`s from them, with no change in behavior.
  - Verify with `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts apps/chat-api/src/config/tests/environment-composition.spec.ts`; both stay green unchanged.
- [x] 1.2 Add the D4 value schemas to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`.
  - Reuse `boundedText` for the non-blank texts.
  - Take the enums from `Object.values(AnnouncementSeverity)` and `Object.values(CelebrationDeliveryMode)`.
  - Take the patterns from 1.1.
  - Give every managed key `managedConfigKey({ title, description, order, value })` with the D7 operator descriptions: no environment-variable names, the HTML subset spelled out, and the compiled event IDs plus `none` named for `ui.activeEventId`.
  - Change `ui.celebrationDelivery.*` from `localOnlyKey(LocalOnlyReason.SecurityPolicy)` to managed. `announcement.html` stays local-only.
  - Update the stale comment above `ONBOARDING_HINTS_SCHEMA`.
  - Verify that `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts` compiles. The descriptions are checked by the env-name test in 1.5.
- [x] 1.3 In `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`:
  - set `MANAGED_CONFIG_SCHEMA_VERSION` to `'1.1.0'` and `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS` to `['1.0.0', '1.1.0']`;
  - run `npm run managed-config-schema` and pin the printed `1.1.0` hash by hand in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`.

  Verify:
  - `ai-dial-chat-1.0.0.json` and its index entry are unchanged (`git diff --exit-code apps/chat-api/managed-config-schema/ai-dial-chat-1.0.0.json`);
  - `index.json` lists both versions with `current` `1.1.0`;
  - a second generator run leaves the tree clean.
- [x] 1.4 Bundle `ai-dial-chat-1.1.0.json` next to the `1.0.0` import in `BUNDLED_ARTIFACTS` (`apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`). Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/snapshot-acceptance.spec.ts`: it compiles both validators and refuses a mismatched pin.
- [x] 1.5 Add the registry rules to `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`:
  - counts: 53 keys, of which 10 managed, 29 local-only and 14 eligible;
  - the exact `1.1.0` managed set;
  - a prerequisite test, next to the default-deployment pair: "manages the four delivery keys together";
  - `announcement.html` still local-only.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
- [x] 1.6 Add `apps/chat-api/src/app-config/tests/managed-config/fixtures/ai-dial-chat-1.1.0.fixtures.json`.
  - Valid fixtures:
    - an empty publication;
    - the representative publication from the spec (10-hint tour, banner, three announcements, 8 scenes and 4 events);
    - each key alone at its maximum;
    - `ui.activeEventId` `company-anniversary` with no allowlist.
  - Invalid fixtures, one per scenario under "Banner text bounds", "Announcement list bounds", "Celebration event bounds" and "Delivery policy bounds", plus `announcement.html` and `welcomeScreen.description` rejected.

  Extend `managed-config-contract.spec.ts` and `managed-config-schema.spec.ts`:
  - fixtures validated with `createStudioAjv` from `studio-contract.fixtures.ts`;
  - exported keys and annotations;
  - `dial:semanticConstraints` unchanged;
  - no URL-carrying member besides the announcement link;
  - "every key at its maximum" exceeds 57,344 canonical bytes, while each key alone and the representative publication fit;
  - the "Same rules as the environment" table, checked against the `validation.spec.ts` examples.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-contract.spec.ts apps/chat-api/src/app-config/tests/managed-config/managed-config-schema.spec.ts`.
- [x] 1.7 Verify that `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts` passes. Rule 3 runs the `1.0.0` valid fixtures against `1.1.0`; the MINOR bump is accepted; the pins match.

## 2. Slice: managed announcements

- [x] 2.1 Update `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.managed-text.spec.ts` and the `empty` rows in `env-resolution-characterization.spec.ts`: a blank `ANNOUNCEMENT_TITLE` or `ANNOUNCEMENT_DESCRIPTION` resolves to `undefined`, and a blank `WELCOME_SCREEN_DESCRIPTION` still resolves to `''`. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.managed-text.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`.
- [x] 2.2 Add parity tests to `apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts` (new; the real 1.1.0 contract end to end, because `managed-activation.spec.ts` mocks the test-only contract in):
  - the same raw description goes through ENV and through a fresh `1.1.0` snapshot with `announcement.description` active, and the two `announcementDescription` values are equal, using the script, `onclick` and link input of the spec;
  - the title stays literal;
  - the `announcement.items` list with a padded title and an unparseable `https://[` link yields the same `announcements` and warning as `ANNOUNCEMENTS`.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts`.
- [x] 2.3 Extend the "export is not activation" test in `app-config.service.spec.ts` (`withManagedFieldsStripped`) so that `ANNOUNCEMENT_TITLE` (blank), `ANNOUNCEMENT_DESCRIPTION`, `ANNOUNCEMENTS`, `UI_EVENT` and the four delivery variables are set. Verify that the stripped and managed results stay equal with `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.
- [x] 2.4 In `managed-content-activation.spec.ts`, cover the unusable states for announcements: `degraded` keeps `R1`'s title; `not_published` gives `[]` for the list while `UI_EVENT=halloween` still applies; rollback republishes `R1`'s payload as `R3`; an active `announcement.title` reading a `1.0.0` snapshot gives `null`. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts`.
- [x] 2.5 Update the `ANNOUNCEMENT_TITLE`, `ANNOUNCEMENT_DESCRIPTION` and `ANNOUNCEMENTS` rows in `apps/chat-api/README.md` and their comments in `apps/chat-api/.env.template`. Each names its managed key and bounds, and says that an explicit value wins and is the fallback. Verify with `npm run validate:docs`.

## 3. Slice: managed event and default switch

- [x] 3.1 In `apps/chat-api/src/app-config/client-config.mapper.ts`, map `none` to `null` in the `ui.activeEventId` entry (D8). Add a case to `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`: `none` gives `null` and `easter` passes through. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`.
- [x] 3.2 Add to `managed-content-activation.spec.ts`:
  - with `UI_EVENT` unset, a published `new-year` that replaces `halloween` is returned after the next accepted read, together with its `metadata.managed.revisionId`;
  - `UI_EVENT=halloween` wins over a published `new-year`;
  - `UI_EVENT=none` wins over a published event;
  - a published `none` gives `null`;
  - `ui.celebrationsEnabledByDefault` published as `false` applies when the variable is unset.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts`.
- [x] 3.3 In `apps/chat/src/context/tests/CelebrationHost.spec.tsx`, add two tests:
  - "switches to the newly configured event without a reload": rerender with `activeEventId` changed from `halloween` to `new-year`, and assert the event and a new reset key passed to the provider;
  - "keeps the reset key when an unrelated config field changes";
  - "requests nothing for an event that is neither compiled nor admitted".

  Query by role or text only, and change no frontend source. Verify with `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx`.
- [x] 3.4 Update the `UI_EVENT` and `UI_EVENT_ENABLED_BY_DEFAULT` rows in `apps/chat-api/README.md` and in `.env.template`: managed key, `none`, and an explicit value wins. Verify with `npm run validate:docs`.

## 4. Slice: managed delivery policy

- [x] 4.1 In `apps/chat-api/src/app-config/managed-runtime/managed-runtime.settings.ts`, make a partial delivery group in `MANAGED_CONFIG_ACTIVE_KEYS` in `active` mode fail startup, with a message naming the variable and the missing keys. Outside `active` mode the existing warning applies. Test it in `apps/chat-api/src/config/tests/managed-config-environment.spec.ts`, next to the existing "not a managed key" case:
  - a partial group fails;
  - the whole group plus `ui.activeEventId` starts;
  - `shadow` with a partial list starts.

  The groups live in `MANAGED_KEY_GROUPS` (`managed-config.constants.ts`). Assert the startup line in `managed-debug-logs.spec.ts`, which owns it. Verify with `npm run test:file -- apps/chat-api/src/config/tests/managed-config-environment.spec.ts apps/chat-api/src/app-config/tests/managed-runtime/managed-debug-logs.spec.ts`.
- [x] 4.2 Add to `managed-content-activation.spec.ts`:
  - with the group active and no delivery variable set, the published policy builds `celebrationDelivery` exactly as in the spec;
  - an explicit `UI_EVENT_EXTERNAL_EVENTS` overrides its part;
  - an explicit `UI_EVENT_DELIVERY_MODE=bundled` keeps `bundled`;
  - `stale` gives the registry default object.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/managed-content-activation.spec.ts`.
- [x] 4.3 Update `apps/chat-api/src/app-config/tests/managed-runtime/shadow-comparison.spec.ts`:
  - a `1.0.0` snapshot on this build yields ten comparisons, nine of them `absent`;
  - `UI_EVENT=halloween` against a published `new-year` is `env_shadowed`;
  - malformed `ANNOUNCEMENTS` against a published list is `differs`.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-runtime/shadow-comparison.spec.ts`.
- [x] 4.4 Update the four delivery rows in `apps/chat-api/README.md` and their `.env.template` comments: managed keys, activated together, an explicit value wins, and `UI_EVENT_DELIVERY_MODE=bundled` is the kill switch. Update the celebrations paragraph in `docs/architecture.md`: the policy reaches `config.celebrationDelivery` from ENV or Config Studio, and the pack source stays `THEMES_CONFIG_URL`. Verify with `npm run validate:docs`.
- [x] 4.5 Run `npm run verify:changed` once for slices 2–4.

## 5. Docs: schema reference and editor guide

- [x] 5.1 Update `docs/managed-config-schema.md`:
  - the class counts (10 / 29 / 14; the current "Thirty-one" is stale);
  - the rollout table from design D1;
  - an "Announcements and celebrations" subsection with the value bounds, the HTML subset, the event-ID rule with no semantic constraint, the delivery security reasoning of D2, the delivery-group activation rule, the `revision` decision, and the payload-total note of D6;
  - the "Export is not activation" blank-text sentence, which now applies to the two announcement texts;
  - the index example;
  - migration-runbook step 5: `1.1.0` first, the earlier keys in `1.2.0`, and each ENV variable removed when its key is activated.

  Verify with `npm run validate:docs`.
- [x] 5.2 Write `docs/managed-content.md`, the Chat editor guide, for content editors who use Config Studio and know neither ENV nor Helm. Sections:
  - **roles**: viewer, publisher, schema manager; Save keeps a private draft, and Publish makes it live;
  - **the onboarding tour**: the fields, `target`, the `?onboarding-anchors` page that outlines every anchor, the per-browser `localStorage` seen-state, and why a new `id` shows the hint again;
  - **announcements**: the banner title and description, the list behind "+N announcements", the HTML subset, `severity`, links;
  - **celebrations**: the event IDs (`halloween`, `new-year`, external ones), `none`, the default switch, the delivery mode and allowlists, the restart token, and how to switch seasons;
  - **Move up/Move down** for ordered lists;
  - **the 56 KiB publication limit**;
  - **export and import between environments**;
  - **rollback** from History;
  - **"why is my change not visible"**: the refresh time, an explicit deployment value wins, and an inactive key.

  Link it from `docs/managed-config-schema.md` and `docs/architecture.md`. Verify with `npm run validate:docs`, which checks the relative links.

## 6. Integration verification

- [x] 6.1 Check the artifact against the generator:
  - `npm run managed-config-schema` reproduces the committed `1.0.0` and `1.1.0` with a clean `git status`;
  - `jq '.versions[] | {schemaVersion, schemaSha256, canonicalBytes}' apps/chat-api/managed-config-schema/index.json` shows both pins, and `1.1.0` stays at or below 57,344 canonical bytes.
- [x] 6.2 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`. `npm run openapi:check` must report no change, because the response shape is unchanged.
- [x] 6.3 Run the checks:
  - `npm run validate:docs`, `npm run validate:specs` and `npm run validate:agent-docs`;
  - `npm run spec:impact` (advisory);
  - `openspec validate manage-announcements-and-celebrations --strict`.
- [x] 6.4 Run `npm run verify:full` once.
  - Result (2026-11-20): typecheck, lint and format passed; `test:full` failed only in `@epam/ai-dial-conversation-input` (`AddAttachmentButton.prompts.spec.tsx`, "renders the overlay content in the desktop flyout on keyboard open"), a library this change does not touch. A rerun of that project without cache passed 443/443, so the failure is a timing flake, not a regression.

## Workflow follow-up

- Prompt 13, the dev rollout, runs only after this change is merged and in the dev image: upload `ai-dial-chat-1.1.0.json` from that commit, publish the ENV content with `ANNOUNCEMENTS` fixed, remove each ENV variable when its key is activated, and activate the delivery group as a whole.
- Archive the change after review, then sync the delta specs.
