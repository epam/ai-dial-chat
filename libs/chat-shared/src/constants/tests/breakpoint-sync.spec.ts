import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_BREAKPOINT_PX,
  MOBILE_MAX_WIDTH_PX,
  PHONE_MEDIA_QUERY,
  TABLET_MEDIA_QUERY,
  TABLET_BREAKPOINT_PX,
} from '../breakpoint';

/*
 * The responsive boundary is single-sourced in chat-shared's breakpoint
 * constants. The sites that can import them (useIsMobile, the
 * catalog virtualizer) cannot drift; the sites that cannot — the Tailwind
 * theme stylesheet, SCSS stylesheets, and the dependency-less chat-overlay
 * package — repeat the literal. This spec pins
 * every repeat to the constant so a boundary move can never leave a site
 * behind silently.
 */

/* The spec lives at libs/chat-shared/src/constants/tests/, five levels below the repo root. */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf-8');

describe('breakpoint-sync', () => {
  it('keeps menu and tablet variants synchronized independently of layout', () => {
    const theme = readRepoFile('tools/tailwind/theme.css');
    expect(theme).toContain(
      `@custom-variant phone (@media ${PHONE_MEDIA_QUERY});`,
    );
    expect(theme).toContain(
      `@custom-variant tablet (@media ${TABLET_MEDIA_QUERY});`,
    );
    expect(theme).toContain(
      `@custom-variant tablet-up (@media (min-width: ${TABLET_BREAKPOINT_PX}px));`,
    );
  });
  it('the Tailwind theme variants match the breakpoint constants', () => {
    const theme = readRepoFile('tools/tailwind/theme.css');

    expect(theme).toContain(
      `@custom-variant mobile (@media (max-width: ${MOBILE_MAX_WIDTH_PX}px));`,
    );
    expect(theme).toContain(
      `@custom-variant desktop (@media (min-width: ${DESKTOP_BREAKPOINT_PX}px));`,
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
    const scheduledTasks = readRepoFile(
      'libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.module.scss',
    );

    expect(scheduledTasks).toContain(
      `@media (max-width: ${MOBILE_MAX_WIDTH_PX}px)`,
    );
  });
});
