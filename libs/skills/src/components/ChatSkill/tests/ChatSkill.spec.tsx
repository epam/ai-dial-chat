import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
});
