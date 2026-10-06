import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublishAccessRuleEditor } from '../PublishAccessRuleEditor';

/* More than `SEARCHABLE_SOURCE_THRESHOLD` (8) so the real kit `Select` shows its search field. */
const SOURCE_OPTIONS = [
  'roles',
  'title',
  'email',
  'department',
  'country',
  'city',
  'office',
  'team',
  'groups',
];

const renderEditor = () =>
  render(
    <PublishAccessRuleEditor
      sourceOptions={SOURCE_OPTIONS}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      labels={{ sourcePlaceholder: 'Choose a source' }}
    />,
  );

describe('PublishAccessRuleEditor — source search', () => {
  it('highlights the matched text of each filtered source option', async () => {
    const user = userEvent.setup();
    renderEditor();

    screen.getByRole('combobox', { name: 'Source' }).focus();
    await user.keyboard('{ArrowDown}');
    await user.type(
      screen.getByRole('textbox', { name: 'Choose a source' }),
      'TI',
    );

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['title']);
    expect(within(options[0]).getByRole('mark').textContent).toBe('ti');
  });

  it('renders source options without a mark while the search query is empty', async () => {
    const user = userEvent.setup();
    renderEditor();

    screen.getByRole('combobox', { name: 'Source' }).focus();
    await user.keyboard('{ArrowDown}');

    const option = screen.getByRole('option', { name: 'roles' });
    expect(within(option).queryByRole('mark')).toBeNull();
  });
});
