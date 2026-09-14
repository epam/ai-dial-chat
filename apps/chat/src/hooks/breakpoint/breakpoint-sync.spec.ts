import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_MAX_WIDTH_PX,
} from '@epam/ai-dial-chat-shared';

/*
 * The responsive boundary is single-sourced in chat-shared's breakpoint
 * constants. The sites that can import them (useBreakpoint, useIsMobile, the
 * catalog virtualizer) cannot drift; the sites that cannot — the root
 * tailwind config (plain CJS run by tooling), SCSS stylesheets, and the
 * dependency-less chat-overlay package — repeat the literal. This spec pins
 * every repeat to the constant so a boundary move can never leave a site
 * behind silently.
 */

/* The spec lives at apps/chat/src/hooks/breakpoint/, five levels below the repo root. */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf-8');

describe('breakpoint-sync', () => {
  it('the root tailwind screens match the breakpoint constants', () => {
    const config = readRepoFile('tailwind.config.js');

    expect(config).toContain(`mobile: { max: '${MOBILE_MAX_WIDTH_PX}px' }`);
    expect(config).toContain(`desktop: { min: '${DESKTOP_BREAKPOINT_PX}px' }`);
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
