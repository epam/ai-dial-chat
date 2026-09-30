import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillUnresolvedReason } from '../../../types/skill-unresolved-reason';
import { SkillInfoTooltipContent } from '../SkillInfoTooltipContent';

/*
 * The trash/lock icon has no accessible role of its own (aria-hidden), so it
 * cannot be located by a semantic query — locate it relative to the message
 * paragraph a semantic query does find.
 */

const iconBesideText = (text: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  screen.getByText(text).parentElement?.querySelector('svg') ?? null;

describe('SkillInfoTooltipContent', () => {
  it('applies viewDetailsTabIndex to the View details button', () => {
    render(
      <SkillInfoTooltipContent
        onViewDetails={vi.fn()}
        viewDetailsTabIndex={-1}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'View details' })
        .getAttribute('tabindex'),
    ).toBe('-1');
  });

  it('keeps the View details button in the Tab sequence by default', () => {
    render(<SkillInfoTooltipContent onViewDetails={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'View details' });
    expect(button.hasAttribute('tabindex')).toBe(false);
  });

  it('renders the deleted message alone when unresolvedReason is deleted', () => {
    render(
      <SkillInfoTooltipContent
        unresolvedReason={SkillUnresolvedReason.Deleted}
        deletedMessage="This skill has been deleted."
        description="Should not render"
        onViewDetails={vi.fn()}
      />,
    );

    expect(screen.getByText('This skill has been deleted.')).toBeTruthy();
    expect(screen.queryByText('Should not render')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('renders the not-shared message alone when unresolvedReason is not-shared', () => {
    render(
      <SkillInfoTooltipContent
        unresolvedReason={SkillUnresolvedReason.NotShared}
        notSharedMessage="Ask the chat owner to share it with you."
        description="Should not render"
        onViewDetails={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Ask the chat owner to share it with you.'),
    ).toBeTruthy();
    expect(screen.queryByText('Should not render')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('renders the description and View details button when unresolvedReason is unset', () => {
    render(
      <SkillInfoTooltipContent
        description="A helpful skill"
        onViewDetails={vi.fn()}
      />,
    );

    expect(screen.getByText('A helpful skill')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View details' })).toBeTruthy();
  });

  it('marks the deleted-state icon aria-hidden', () => {
    render(
      <SkillInfoTooltipContent
        unresolvedReason={SkillUnresolvedReason.Deleted}
        deletedMessage="This skill has been deleted."
        onViewDetails={vi.fn()}
      />,
    );

    const icon = iconBesideText('This skill has been deleted.');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the not-shared-state icon aria-hidden', () => {
    render(
      <SkillInfoTooltipContent
        unresolvedReason={SkillUnresolvedReason.NotShared}
        notSharedMessage="Ask the chat owner to share it with you."
        onViewDetails={vi.fn()}
      />,
    );

    const icon = iconBesideText('Ask the chat owner to share it with you.');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the unsupported message alone when unresolvedReason is unset but isUnsupported applies', () => {
    render(
      <SkillInfoTooltipContent
        unsupportedMessage="Selected model does not support skills."
        onViewDetails={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Selected model does not support skills.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });
});
