import { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduledTaskSkillField from '../ScheduledTaskSkillField';

const state = vi.hoisted(() => ({
  isMobile: false,
  toggleFavorite: vi.fn(),
  favoriteIds: new Set([
    'skills/own/report',
    'skills/shared/summary',
    'skills/public/translate',
  ]),
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => state.isMobile,
}));
vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: () => state,
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
    ],
  }),
}));
vi.mock(
  '../../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayName',
  () => ({ useScheduledTaskSkillDisplayName: () => undefined }),
);
vi.mock('../../CatalogView/CatalogView', () => ({
  default: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button onClick={() => onSelect('skills/public/catalog')}>
      Catalog selection
    </button>
  ),
}));

beforeEach(() => {
  state.isMobile = false;
  state.toggleFavorite.mockReset();
});

describe('ScheduledTaskSkillField', () => {
  it.each([false, true])(
    'selects host favorites and browses the catalog (mobile: %s)',
    async (isMobile) => {
      state.isMobile = isMobile;
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <>
          <span id="skill-label">Skill</span>
          <ScheduledTaskSkillField
            isSkillsSupported
            labelledById="skill-label"
            onChange={onChange}
          />
        </>,
      );
      const trigger = screen.getByRole('combobox', { name: 'Skill' });
      await user.click(trigger);
      expect(screen.getByText('Own report')).toBeTruthy();
      expect(screen.getByText('Shared summary')).toBeTruthy();
      expect(screen.getByText('Public translate')).toBeTruthy();
      expect(screen.queryByText('Not favorite')).toBeNull();
      if (isMobile)
        expect(
          screen.getByRole('dialog', { name: 'skillSelector.modalTitle' }),
        ).toBeTruthy();
      await user.click(screen.getByText('Shared summary'));
      expect(onChange).toHaveBeenCalledWith('skills/shared/summary');
      await user.click(trigger);
      await user.click(screen.getByRole('button', { name: 'buttons.browse' }));
      await user.click(
        await screen.findByRole('button', { name: 'Catalog selection' }),
      );
      expect(onChange).toHaveBeenLastCalledWith('skills/public/catalog');
      await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    },
  );

  it('removes a favorite through the existing skill favorite operation without selecting it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <span id="skill-label">Skill</span>
        <ScheduledTaskSkillField
          isSkillsSupported
          labelledById="skill-label"
          onChange={onChange}
        />
      </>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.click(
      screen.getAllByRole('button', {
        name: 'favorites.removeFromFavoritesLabel',
      })[0],
    );
    await waitFor(() =>
      expect(state.toggleFavorite).toHaveBeenCalledWith(
        'skills/own/report',
        false,
        FavoriteEntityType.Skill,
      ),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
