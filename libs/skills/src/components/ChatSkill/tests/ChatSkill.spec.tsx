import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SkillUnresolvedReason } from '../../../types/skill-unresolved-reason';
import { ChatSkill } from '../ChatSkill';

describe('ChatSkill', () => {
  it('opens its description card only after click in click mode', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();

    render(
      <ChatSkill
        name="summarize"
        path="skills/bucket/summarize"
        description="Summarizes the supplied text."
        detailsTrigger="click"
        onViewDetails={onViewDetails}
      />,
    );

    expect(screen.queryByText('Summarizes the supplied text.')).toBeNull();

    await user.click(screen.getByLabelText('/summarize'));

    expect(
      await screen.findByText('Summarizes the supplied text.'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'View details' }));

    expect(onViewDetails).toHaveBeenCalledWith('skills/bucket/summarize');
  });

  it.each(['{Enter}', ' '])(
    'opens its description card with %s in click mode',
    async (key) => {
      const user = userEvent.setup();

      render(
        <ChatSkill
          name="summarize"
          path="skills/bucket/summarize"
          description="Summarizes the supplied text."
          detailsTrigger="click"
          onViewDetails={vi.fn()}
        />,
      );

      const chip = screen.getByLabelText('/summarize');
      chip.focus();
      await user.keyboard(key);

      expect(
        await screen.findByText('Summarizes the supplied text.'),
      ).toBeTruthy();
    },
  );

  it('shows the deleted message with no View details button when unresolvedReason is deleted', async () => {
    const user = userEvent.setup();

    render(
      <ChatSkill
        name="summarize"
        path="skills/bucket/summarize"
        description="Summarizes the supplied text."
        unresolvedReason={SkillUnresolvedReason.Deleted}
        detailsTrigger="click"
        onViewDetails={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('/summarize'));

    expect(
      await screen.findByText(
        'This skill has been deleted. Its details are no longer available.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Summarizes the supplied text.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('shows the not-shared message with no View details button when unresolvedReason is not-shared', async () => {
    const user = userEvent.setup();

    render(
      <ChatSkill
        name="summarize"
        path="skills/bucket/summarize"
        description="Summarizes the supplied text."
        unresolvedReason={SkillUnresolvedReason.NotShared}
        detailsTrigger="click"
        onViewDetails={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('/summarize'));

    expect(
      await screen.findByText(
        "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Summarizes the supplied text.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('opens the unresolved tooltip via keyboard focus in click mode with no keyboard-actionable View details', async () => {
    const user = userEvent.setup();

    render(
      <ChatSkill
        name="summarize"
        path="skills/bucket/summarize"
        unresolvedReason={SkillUnresolvedReason.NotShared}
        detailsTrigger="click"
        onViewDetails={vi.fn()}
      />,
    );

    const chip = screen.getByLabelText('/summarize');
    chip.focus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByText(
        "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('renders the /{name} label the same way whether or not unresolvedReason is set', () => {
    render(
      <ChatSkill
        name="summarize"
        path="skills/bucket/summarize"
        unresolvedReason={SkillUnresolvedReason.Deleted}
        onViewDetails={vi.fn()}
      />,
    );

    const chip = screen.getByLabelText('/summarize');
    expect(chip.className).toContain('dial-body-paragraph-text');
    expect(chip.className).toContain('text-accent');
    expect(chip.className).not.toContain('bg-error');
  });

  it('lays the chip out inline so it wraps at the same points as the raw textarea text', () => {
    render(
      <ChatSkill
        name="qa-dev-rs-haiku-0923"
        path="skills/bucket/qa-dev-rs-haiku-0923"
        onViewDetails={vi.fn()}
      />,
    );

    const chipClasses = screen
      .getByLabelText('/qa-dev-rs-haiku-0923')
      .className.split(' ');
    expect(chipClasses).toContain('inline');
    expect(chipClasses).not.toContain('inline-block');
  });
});
