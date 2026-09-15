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
