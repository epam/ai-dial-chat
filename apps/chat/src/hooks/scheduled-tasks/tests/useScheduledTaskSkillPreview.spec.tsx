import { ScheduledTaskDetailsSummary } from '@epam/ai-dial-scheduled-tasks';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskSkillPreview } from '../useScheduledTaskSkillPreview';

const { metadata } = vi.hoisted(() => ({ metadata: vi.fn() }));
vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({ skills: [], publicSkills: [] }),
}));
vi.mock('../../../server-api/skills.api', () => ({
  getSkillMetadata: metadata,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name: string }) =>
      key.endsWith('unavailableSkillName')
        ? `${options?.name} (unavailable)`
        : 'The skill has been deleted or access revoked',
  }),
}));

const Preview = () => {
  const preview = useScheduledTaskSkillPreview([
    'skills/public/folder/Weekly%20report',
  ]);
  return (
    <ScheduledTaskDetailsSummary
      {...preview}
      modelLabel="Model"
      skillLabel="Skill"
      instructionsLabel="Instructions"
    />
  );
};

describe('scheduled task skill preview', () => {
  beforeEach(() => {
    metadata.mockReset();
  });

  it.each([400, 403, 404])(
    'shows an unavailable name and explanation for HTTP %s',
    async (status) => {
      metadata.mockRejectedValue({
        response: { status, json: async () => ({}) },
      });
      const user = userEvent.setup();
      render(<Preview />);
      const skill = await screen.findByText('Weekly report (unavailable)');
      expect(skill.className).toContain('text-error');
      expect(skill.className).toContain('cursor-pointer');
      expect(metadata).toHaveBeenCalledTimes(1);
      await user.hover(skill);
      expect((await screen.findByRole('tooltip')).textContent).toBe(
        'The skill has been deleted or access revoked',
      );
    },
  );

  it('shows the resolved name for an accessible skill', async () => {
    metadata.mockResolvedValue({ name: 'Accessible report' });
    render(<Preview />);
    expect(await screen.findByText('Accessible report')).toBeTruthy();
    expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
  });

  it('does not expose the saved path while metadata is pending', async () => {
    let resolve!: (value: { name: string }) => void;
    metadata.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<Preview />);
    expect(
      screen.queryByText('skills/public/folder/Weekly%20report'),
    ).toBeNull();
    expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
    await act(async () => resolve({ name: 'Weekly report' }));
    expect(await screen.findByText('Weekly report')).toBeTruthy();
  });

  it('does not mark a temporary failure as unavailable', async () => {
    metadata.mockRejectedValue({
      response: { status: 503, json: async () => ({}) },
    });
    render(<Preview />);
    expect(
      await screen.findByText('skills/public/folder/Weekly%20report'),
    ).toBeTruthy();
    expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
  });
});
