import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduledTaskSkillField from '../ScheduledTaskSkillField';

vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({
    skills: [
      { url: 'skills/own/report', name: 'Own report' },
      { url: 'skills/own/other', name: 'Not favorite' },
    ],
    sharedWithMe: [{ url: 'skills/shared/summary', name: 'Shared summary' }],
    publicSkills: [
      { url: 'skills/public/translate', name: 'Public translate' },
      { url: 'skills/own/report', name: 'Own report' },
    ],
  }),
}));
vi.mock(
  '../../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames',
  () => ({ useScheduledTaskSkillDisplayNames: () => [] }),
);
describe('ScheduledTaskSkillField', () => {
  it('offers every own, shared and public skill once, without favorites or Browse', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduledTaskSkillField
        fieldLabel="Skill"
        value={[]}
        isSkillsSupported
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole('combobox', {
        name: 'Skill',
      }),
    );
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'Not favorite' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'buttons.browse' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Shared summary' }));
    expect(onChange).toHaveBeenCalledWith(['skills/shared/summary']);
  });
});
