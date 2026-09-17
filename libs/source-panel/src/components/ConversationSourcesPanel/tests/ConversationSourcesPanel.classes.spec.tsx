import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SOURCE_PANEL_CLASS } from '../../../constants/public-class-names';
import type { ConversationSourcesPanelLabels } from '../../../models/conversation-sources-panel-props';
import ConversationSourcesPanel from '../ConversationSourcesPanel';

/*
 * The public class name is this package's styling contract. A lost class fails
 * silently — the build passes and a host's stylesheet simply stops applying —
 * so it is asserted here rather than left to review.
 *
 * The panel is drawn by `@epam/ai-dial-sidebar`, so the class travels as
 * `styles.className` and lands on the wrapper around the `aside` — the element
 * that owns the panel's width and transition. The stub below keeps that split.
 */

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelNoResults: ({ label }: { label: string }) => <div>{label}</div>,
  SidebarOrientation: { Left: 'left', Right: 'right' },
  SidebarPanel: ({
    children,
    labels,
    styles,
  }: {
    children: ReactNode;
    labels?: { ariaLabel?: string };
    styles?: { className?: string };
  }) => (
    /* The real panel puts `styles.className` on the wrapper that owns its
       width and transition, and `dial-sb-aside` on the `aside` inside it. The
       stub keeps that split, or the assertion below proves nothing. */
    <div className={styles?.className}>
      <aside aria-label={labels?.ariaLabel} className="dial-sb-aside">
        {children}
      </aside>
    </div>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24, SM: 16 },
  ElementSize: { Small: 'small' },
  mergeClasses: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  GhostIconButton: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <button aria-label={ariaLabel} />
  ),
  NoDataContent: ({ title }: { title: ReactNode }) => <div>{title}</div>,
  Search: () => <input />,
}));

const LABELS: ConversationSourcesPanelLabels = {
  ariaLabel: 'Sources panel',
  closeLabel: 'Close',
  searchPlaceholder: 'Search',
  searchClearLabel: 'Clear search',
  noDataLabel: 'No data',
  noResultsLabel: 'No results',
  downloadAllLabel: 'Download all',
  uploadedSectionTitle: 'Uploaded files',
  generatedSectionTitle: 'Generated files',
  sourcesSectionTitle: 'Sources',
  copySourceLabel: 'Copy',
  attachmentClickLabel: 'Download',
};

const renderPanel = (isMobile: boolean, isOpen: boolean) =>
  render(
    <ConversationSourcesPanel
      isOpen={isOpen}
      onClose={vi.fn()}
      uploaded={[]}
      generated={[]}
      sources={[]}
      isMobile={isMobile}
      labels={LABELS}
    />,
  );

/*
 * The wrapper carries no role of its own, so each case locates the region by
 * role and walks up to the stamped element.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

const findPanel = () =>
  closestWithClass(
    screen.getByRole('complementary', { name: LABELS.ariaLabel }),
    SOURCE_PANEL_CLASS.panel,
  );

describe('ConversationSourcesPanel — public class names', () => {
  it('stamps the panel on the desktop layout', () => {
    renderPanel(false, true);

    expect(findPanel()).toBeTruthy();
  });

  it('keeps the class beside the mobile full-width utility', () => {
    renderPanel(true, true);

    /* The width utility is conditional; the public class never is. */
    const panel = findPanel();
    expect(panel).toBeTruthy();
    expect(panel!.classList).toContain('w-full');
  });

  it('stamps the panel while it is closed', () => {
    renderPanel(false, false);

    expect(findPanel()).toBeTruthy();
  });
});
