import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduledTaskSkillField from '../ScheduledTaskSkillField';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name: string }) =>
      options?.name ? `${options.name} (unavailable)` : key,
  }),
}));

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
describe('ScheduledTaskSkillField', () => {
  it('formats unavailable references as removable short names', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduledTaskSkillField
        fieldLabel="Skill"
        value={['skills/own/My%20skill']}
        resolvedSkills={[
          {
            url: 'skills/own/My%20skill',
            name: 'skills/own/My%20skill',
            isUnavailable: true,
            isLoading: false,
          },
        ]}
        isSkillsSupported
        onChange={onChange}
      />,
    );
    expect(screen.getByText('My skill (unavailable)')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'skillSelector.removeSkillLabel' }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });
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
