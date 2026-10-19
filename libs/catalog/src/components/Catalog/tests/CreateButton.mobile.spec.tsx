import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CreateButton } from '../CreateButton';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => true };
});

const MobileCreateButton = ({
  onWrite,
  onUpload,
  onChange = vi.fn(),
}: {
  onWrite: () => void;
  onUpload: () => void;
  onChange?: (value: string) => void;
}) => {
  const [value, setValue] = useState('');
  const options = [
    { key: 'prompt', label: 'Prompt', onClick: vi.fn() },
    {
      key: 'skill',
      label: 'Skill',
      children: [
        {
          key: 'skill-write-instructions',
          label: 'Write instructions',
          onClick: onWrite,
        },
        { key: 'skill-upload', label: 'Upload', onClick: onUpload },
      ],
    },
  ].filter((option) =>
    option.label.toLowerCase().includes(value.toLowerCase()),
  );
  return (
    <CreateButton
      label="Create"
      options={options}
      search={{
        value,
        onChange: (next) => {
          setValue(next);
          onChange(next);
        },
      }}
      searchPlaceholder="Find"
      noResultsLabel="Nothing matches"
    />
  );
};

describe('CreateButton — mobile', () => {
  it('opens the menu in a bottom sheet instead of a floating dropdown', async () => {
    render(<MobileCreateButton onWrite={vi.fn()} onUpload={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    const sheet = await screen.findByRole('dialog', { name: 'Create' });
    expect(within(sheet).getByLabelText('Find')).toBeTruthy();
    expect(
      within(sheet)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Prompt', 'Skill']);
  });

  it('drills into the Skill page and runs the chosen child', async () => {
    const onUpload = vi.fn();
    render(<MobileCreateButton onWrite={vi.fn()} onUpload={onUpload} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Skill' }),
    );

    const page = await screen.findByRole('dialog', { name: 'Skill' });
    expect(
      within(page)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Write instructions', 'Upload']);

    await userEvent.click(
      within(page).getByRole('menuitem', { name: 'Upload' }),
    );

    expect(onUpload).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns from the Skill page to the root page with the back button', async () => {
    render(<MobileCreateButton onWrite={vi.fn()} onUpload={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Skill' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('dialog', { name: 'Create' })).toBeTruthy();
  });

  it('announces the no-results label and clears the query on close', async () => {
    const onChange = vi.fn();
    render(
      <MobileCreateButton
        onWrite={vi.fn()}
        onUpload={vi.fn()}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Find'), 'zzz');

    expect(screen.getByRole('status').textContent).toBe('Nothing matches');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
