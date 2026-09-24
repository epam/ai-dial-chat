/*
 * Guard tests for this package's public `dial-*` class contract — see the
 * "Public class names" section of openspec/lib-styling-guide.md.
 *
 * A styling hook sits on an unlabeled wrapper with no accessible role or text
 * of its own, so asserting one is inherently a DOM-level check and Testing
 * Library has no semantic equivalent of "is this class on that element's
 * ancestor". Every test still locates a real element by role, label or text
 * first and only then walks to the container under test, so a class landing on
 * the wrong node fails rather than passes. Hence the rule exemption below.
 */
/* eslint-disable testing-library/no-node-access */
import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_INPUT_CLASS } from '../../../constants/public-class-names';
import hookStyles from '../../../hooks/useModelSelector.module.scss';
import sheetStyles from '../../ModelSelectorBottomSheet/ModelSelectorBottomSheet.module.scss';
import { ModelSelectorControl } from '../ModelSelectorControl';

const makeDeployments = (): DeploymentItem[] => [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
  { id: 'claude', displayName: 'Claude', type: 'model' },
];

const renderControl = (
  props: Partial<Parameters<typeof ModelSelectorControl>[0]> = {},
) =>
  render(
    <ModelSelectorControl
      deployments={makeDeployments()}
      selectedDeploymentId="claude"
      onDeploymentChange={vi.fn()}
      modelSelectorLabels={{ ariaLabel: 'Select model' }}
      isStreaming={false}
      isMobile={false}
      style={{}}
      {...props}
    />,
  );

/*
 * The public classes are host styling hooks, so a test must never find an
 * element *by* the class — that would still pass with the class on the wrong
 * node. Locate by role or text first, then walk up to the container under test.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  from.closest(`.${className}`);

describe('ModelSelectorControl — public class names', () => {
  it('marks the desktop menu root when opened', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    await user.click(screen.getByLabelText(/Select model/));

    expect(
      closestWithClass(
        await screen.findByText('GPT-4o'),
        CONVERSATION_INPUT_CLASS.modelMenu,
      ),
    ).toBeTruthy();
  });

  it('marks every row and only the selected one as selected', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    await user.click(screen.getByLabelText(/Select model/));

    /*
     * The selected model's name also appears in the trigger button, so the row
     * lookup is scoped to the open menu rather than the whole document.
     */
    const menu = closestWithClass(
      await screen.findByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    const unselected = closestWithClass(
      within(menu as HTMLElement).getByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenuItem,
    );
    const selected = closestWithClass(
      within(menu as HTMLElement).getByText('Claude'),
      CONVERSATION_INPUT_CLASS.modelMenuItem,
    );

    expect(unselected).toBeTruthy();
    expect(selected).toBeTruthy();
    expect(unselected!.classList).not.toContain(
      CONVERSATION_INPUT_CLASS.modelMenuItemSelected,
    );
    expect(selected!.classList).toContain(
      CONVERSATION_INPUT_CLASS.modelMenuItemSelected,
    );
  });

  it('marks the search header of the desktop menu', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    await user.click(screen.getByLabelText(/Select model/));
    await screen.findByText('GPT-4o');

    expect(
      document.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.modelMenuSearch}`),
    ).toHaveLength(1);
  });

  it('marks the mobile bottom sheet as the menu root', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ isMobile: true });

    await user.click(screen.getByLabelText(/Select model/));

    expect(
      closestWithClass(
        await screen.findByRole('dialog'),
        CONVERSATION_INPUT_CLASS.modelMenu,
      ),
    ).toBeTruthy();
  });

  it('marks the host-supplied model picker overlay as the menu root on mobile', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({
      isMobile: true,
      modelPickerOverlay: () => <span>overlay content</span>,
    });

    await user.click(screen.getByLabelText(/Select model/));

    expect(
      closestWithClass(
        await screen.findByText('overlay content'),
        CONVERSATION_INPUT_CLASS.modelMenu,
      ),
    ).toBeTruthy();
  });

  /*
   * `isLoading` is not a prop — the hook derives it from a supplied
   * `modelSelectorLabels.loading`, which swaps the deployment rows for
   * skeletons.
   */
  it('marks no row while the deployment list is loading', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({
      modelSelectorLabels: { ariaLabel: 'Select model', loading: 'Loading…' },
    });

    await user.click(screen.getByLabelText(/Select model/));
    await screen.findByText('Loading…');

    expect(
      document.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.modelMenuItem}`),
    ).toHaveLength(0);
  });

  it('marks no row for the empty state', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({
      deployments: [],
      selectedDeploymentId: null,
      modelSelectorLabels: { ariaLabel: 'Select model', empty: 'No models' },
    });

    await user.click(screen.getByLabelText(/Select model/));
    await screen.findByText('No models');

    expect(
      document.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.modelMenuItem}`),
    ).toHaveLength(0);
  });
});

describe('ModelSelectorControl — trigger icon and caret classes', () => {
  /*
   * The trigger is located by its accessible name in every presentation, so a
   * class landing on the menu, a row, or the wrong presentation's chip fails.
   */
  const readTriggerParts = (trigger: Element) => ({
    iconWrap: trigger.querySelector(
      `.${CONVERSATION_INPUT_CLASS.modelSelectorIcon}`,
    ),
    caret: trigger.querySelector(
      `.${CONVERSATION_INPUT_CLASS.modelSelectorCaret}`,
    ),
  });

  it('marks the icon wrap and the caret inside the desktop trigger', () => {
    renderControl();

    const { iconWrap, caret } = readTriggerParts(
      screen.getByLabelText(/Select model/),
    );

    expect(iconWrap).toBeTruthy();
    expect(caret).toBeTruthy();
  });

  it('marks them inside the chip rendered for a host-supplied overlay', () => {
    renderControl({ modelPickerOverlay: () => <span>overlay content</span> });

    const { iconWrap, caret } = readTriggerParts(
      screen.getByLabelText(/Select model/),
    );

    expect(iconWrap).toBeTruthy();
    expect(caret).toBeTruthy();
  });

  it('marks them inside the mobile trigger', () => {
    renderControl({ isMobile: true });

    const { iconWrap, caret } = readTriggerParts(
      screen.getByLabelText(/Select model/),
    );

    expect(iconWrap).toBeTruthy();
    expect(caret).toBeTruthy();
  });

  it('keeps the caret decorative so the trigger keeps its own name', () => {
    renderControl();

    const { caret } = readTriggerParts(screen.getByLabelText(/Select model/));

    expect(caret?.getAttribute('aria-hidden')).toBe('true');
  });

  it('emits one icon wrap and one caret per trigger', () => {
    renderControl();

    expect(
      document.querySelectorAll(
        `.${CONVERSATION_INPUT_CLASS.modelSelectorIcon}`,
      ),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(
        `.${CONVERSATION_INPUT_CLASS.modelSelectorCaret}`,
      ),
    ).toHaveLength(1);
  });
});

describe('ModelSelectorControl — host menu styles', () => {
  const menuStyles = {
    className: 'host-menu',
    searchHeaderClassName: 'host-search',
    itemClassName: 'host-row',
    selectedItemClassName: 'host-row-selected',
    colors: { searchHeaderBackground: 'rgb(1, 2, 3)' },
  };

  /*
   * Rows are located by their visible label inside the open menu, then walked
   * up to the row box that carries the public row class.
   */
  const readRows = (menu: Element) => ({
    unselected: closestWithClass(
      within(menu as HTMLElement).getByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenuItem,
    ),
    selected: closestWithClass(
      within(menu as HTMLElement).getByText('Claude'),
      CONVERSATION_INPUT_CLASS.modelMenuItem,
    ),
  });

  const readSearchRow = () =>
    closestWithClass(
      screen.getByPlaceholderText('Search'),
      CONVERSATION_INPUT_CLASS.modelMenuSearch,
    ) as HTMLElement | null;

  it('styles the desktop panel, search row and rows', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ menuStyles });

    await user.click(screen.getByLabelText(/Select model/));
    const menu = closestWithClass(
      await screen.findByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    expect(menu?.classList).toContain('host-menu');

    const search = readSearchRow();
    expect(search?.classList).toContain('host-search');
    // Merged after the default, not in place of it: the sticky layout stays.
    expect(search?.classList).toContain('sticky');
    expect(search?.style.getPropertyValue('--ms-search-header-bg')).toBe(
      'rgb(1, 2, 3)',
    );

    const { unselected, selected } = readRows(menu!);
    expect(unselected?.classList).toContain('host-row');
    expect(unselected?.classList).not.toContain('host-row-selected');
    expect(selected?.classList).toContain('host-row');
    expect(selected?.classList).toContain('host-row-selected');
  });

  it('styles the mobile sheet with the same hooks', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ isMobile: true, menuStyles });

    await user.click(screen.getByLabelText(/Select model/));
    const sheet = closestWithClass(
      await screen.findByRole('dialog'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    expect(sheet?.classList).toContain('host-menu');

    const search = readSearchRow();
    expect(search?.classList).toContain('host-search');
    expect(search?.style.getPropertyValue('--ci-sheet-search-bg')).toBe(
      'rgb(1, 2, 3)',
    );

    const { unselected, selected } = readRows(sheet!);
    expect(unselected?.classList).toContain('host-row');
    expect(unselected?.classList).not.toContain('host-row-selected');
    expect(unselected?.classList).not.toContain(
      CONVERSATION_INPUT_CLASS.modelMenuItemSelected,
    );
    expect(selected?.classList).toContain('host-row');
    expect(selected?.classList).toContain('host-row-selected');
    expect(selected?.classList).toContain(
      CONVERSATION_INPUT_CLASS.modelMenuItemSelected,
    );
  });

  it('styles the panel of a host-supplied overlay', async () => {
    renderControl({
      menuStyles,
      modelPickerOverlay: () => <span>overlay content</span>,
      isPickerOpen: true,
    });

    const panel = closestWithClass(
      await screen.findByText('overlay content'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    expect(panel?.classList).toContain('host-menu');
  });

  const rowColors = {
    itemText: 'rgb(10, 10, 10)',
    itemHoverBackground: 'rgb(20, 20, 20)',
    selectedItemBackground: 'rgb(30, 30, 30)',
    selectedItemText: 'rgb(40, 40, 40)',
    checkIcon: 'rgb(50, 50, 50)',
  };

  it('carries the row colours onto the portalled desktop panel', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ menuStyles: { colors: rowColors } });

    await user.click(screen.getByLabelText(/Select model/));
    const menu = closestWithClass(
      await screen.findByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    ) as HTMLElement;

    expect(menu.style.getPropertyValue('--ms-item-text')).toBe(
      'rgb(10, 10, 10)',
    );
    expect(menu.style.getPropertyValue('--ms-item-hover-bg')).toBe(
      'rgb(20, 20, 20)',
    );
    expect(menu.style.getPropertyValue('--ms-selected-item-bg')).toBe(
      'rgb(30, 30, 30)',
    );
    expect(menu.style.getPropertyValue('--ms-selected-item-text')).toBe(
      'rgb(40, 40, 40)',
    );
    expect(menu.style.getPropertyValue('--ms-check-icon')).toBe(
      'rgb(50, 50, 50)',
    );
    // The dropdown's own positioning still applies on top of the host vars.
    expect(menu.style.position).not.toBe('');
  });

  it('applies the selected-row colour hooks to the selected row only', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ menuStyles: { colors: rowColors } });

    await user.click(screen.getByLabelText(/Select model/));
    const menu = closestWithClass(
      await screen.findByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    const { unselected, selected } = readRows(menu!);

    for (const row of [unselected, selected]) {
      expect(row?.classList).toContain(hookStyles.itemText);
      expect(row?.classList).toContain(hookStyles.itemHover);
    }
    for (const className of [
      hookStyles.selectedItemBackground,
      hookStyles.selectedItemText,
      hookStyles.checkIcon,
    ]) {
      expect(selected?.classList).toContain(className);
      expect(unselected?.classList).not.toContain(className);
    }
  });

  it('adds no colour hook to a row when no colours are passed', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    await user.click(screen.getByLabelText(/Select model/));
    const menu = closestWithClass(
      await screen.findByText('GPT-4o'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    ) as HTMLElement;
    const { selected } = readRows(menu);

    for (const className of [
      hookStyles.itemText,
      hookStyles.itemHover,
      hookStyles.selectedItemBackground,
      hookStyles.selectedItemText,
      hookStyles.checkIcon,
    ]) {
      expect(selected?.classList).not.toContain(className);
    }
    expect(menu.style.getPropertyValue('--ms-item-text')).toBe('');
  });

  it('carries the same row colours into the mobile sheet', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ isMobile: true, menuStyles: { colors: rowColors } });

    await user.click(screen.getByLabelText(/Select model/));
    const sheet = closestWithClass(
      await screen.findByRole('dialog'),
      CONVERSATION_INPUT_CLASS.modelMenu,
    );
    const { unselected, selected } = readRows(sheet!);
    const varsHost = selected?.closest(
      '[style*="--ci-sheet-selected-bg"]',
    ) as HTMLElement | null;

    expect(varsHost?.style.getPropertyValue('--ci-sheet-text')).toBe(
      'rgb(10, 10, 10)',
    );
    expect(varsHost?.style.getPropertyValue('--ci-sheet-item-hover')).toBe(
      'rgb(20, 20, 20)',
    );
    expect(varsHost?.style.getPropertyValue('--ci-sheet-selected-bg')).toBe(
      'rgb(30, 30, 30)',
    );
    expect(varsHost?.style.getPropertyValue('--ci-sheet-selected-text')).toBe(
      'rgb(40, 40, 40)',
    );
    expect(varsHost?.style.getPropertyValue('--ci-check-icon')).toBe(
      'rgb(50, 50, 50)',
    );
    for (const className of [
      sheetStyles.itemSelectedBackground,
      sheetStyles.itemSelectedText,
    ]) {
      expect(selected?.classList).toContain(className);
      expect(unselected?.classList).not.toContain(className);
    }
  });

  it('leaves the defaults alone when no styles are passed', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    await user.click(screen.getByLabelText(/Select model/));
    await screen.findByText('GPT-4o');

    const search = readSearchRow();
    expect(search?.classList).toContain('sticky');
    expect(search?.style.getPropertyValue('--ms-search-header-bg')).toBe('');
  });
});
