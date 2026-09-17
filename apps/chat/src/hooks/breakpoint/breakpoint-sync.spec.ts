import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_MAX_WIDTH_PX,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';

/*
 * The responsive boundary is single-sourced in chat-shared's breakpoint
 * constants. The sites that can import them (useBreakpoint, useIsMobile, the
 * catalog virtualizer) cannot drift; the sites that cannot — the published
 * Tailwind preset (plain CJS run by tooling, and by a host's own build), SCSS
 * stylesheets, and the dependency-less chat-overlay package — repeat the
 * literal. This spec pins every repeat to the constant so a boundary move can
 * never leave a site behind silently.
 */

/* The spec lives at apps/chat/src/hooks/breakpoint/, five levels below the repo root. */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf-8');

describe('breakpoint-sync', () => {
  it('the Tailwind preset screens match the breakpoint constants', () => {
    /*
     * The named screens live in the preset rather than in the repo-root config,
     * which now contributes only this repository's content globs — a host
     * inherits the boundary by extending
     * `@epam/ai-dial-chat-shared/tailwind-preset`.
     */
    const preset = readRepoFile('libs/chat-shared/tailwind-preset.cjs');

    expect(preset).toContain(`mobile: { max: '${MOBILE_MAX_WIDTH_PX}px' }`);
    expect(preset).toContain(`desktop: { min: '${DESKTOP_BREAKPOINT_PX}px' }`);
  });

  it('the repo-root config extends the preset that owns the screens', () => {
    /*
     * Every app and lib config extends the repo-root file, so the boundary only
     * reaches them through this line; without it the named screens would be
     * absent and `mobile:`/`desktop:` utilities would silently emit nothing.
     */
    expect(readRepoFile('tailwind.config.js')).toContain(
      "presets: [require('./libs/chat-shared/tailwind-preset.cjs')]",
    );
  });

  it('the chat-overlay mobile breakpoint matches the breakpoint constants', () => {
    const source = readRepoFile(
      'libs/chat-overlay/src/lib/ChatOverlayManager.ts',
    );

    expect(source).toContain(
      `const MOBILE_BREAKPOINT_PX = ${MOBILE_MAX_WIDTH_PX};`,
    );
  });

  it('the SCSS @media mirrors match the breakpoint constants', () => {
    const publishPanel = readRepoFile(
      'libs/publish-panel/src/components/PublishAccessRuleEditor/PublishAccessRuleEditor.module.scss',
    );
    const scheduledTasks = readRepoFile(
      'libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.module.scss',
    );

    expect(publishPanel).toContain(
      `@media (min-width: ${DESKTOP_BREAKPOINT_PX}px)`,
    );
    expect(scheduledTasks).toContain(
      `@media (max-width: ${MOBILE_MAX_WIDTH_PX}px)`,
    );
  });
});
