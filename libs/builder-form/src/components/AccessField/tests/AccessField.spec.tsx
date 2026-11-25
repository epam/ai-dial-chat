import { AccessLevel } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCESS_FIELD_LABELS } from '../../../constants/access';
import {
  type AccessContentOption,
  type AccessEntry,
  type AccessReadOnlyChip,
} from '../../../models/access';
import { AccessField } from '../AccessField';

const options: AccessContentOption[] = [
  {
    id: 'files',
    label: 'Files',
    allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
  },
  {
    id: 'prompts',
    label: 'Prompts',
    allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
  },
  { id: 'tools', label: 'Toolsets', allowedAccess: [AccessLevel.Read] },
];

const user = userEvent.setup({ delay: null });

interface HostProps {
  initial?: AccessEntry[];
  readOnlyChips?: AccessReadOnlyChip[];
  noticeText?: string;
  onChange?: (entries: AccessEntry[]) => void;
}

const Host = ({
  initial = [],
  readOnlyChips,
  noticeText,
  onChange,
}: HostProps) => {
  const [value, setValue] = useState(initial);
  return (
    <AccessField
      value={value}
      onChange={(entries) => {
        setValue(entries);
        onChange?.(entries);
      }}
      contentOptions={options}
      readOnlyChips={readOnlyChips}
      noticeText={noticeText}
      labels={DEFAULT_ACCESS_FIELD_LABELS}
    />
  );
};

const FILES_READ: AccessEntry = {
  contentId: 'files',
  level: AccessLevel.Read,
};
const PROMPTS_RW: AccessEntry = {
  contentId: 'prompts',
  level: AccessLevel.ReadWrite,
};

const chipTexts = (): string[] =>
  screen.queryAllByRole('listitem').map((item) => item.textContent ?? '');

describe('AccessField', () => {
  beforeEach(() => {
    /* jsdom has no IntersectionObserver; the kit dropdown list observes its items. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the title, description and Configure button', () => {
    render(<Host />);
    expect(screen.getByRole('heading', { name: 'Access' })).toBeTruthy();
    expect(
      screen.getByText(
        'What this app can reach. Shown to users before they install.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeTruthy();
  });

  it('names the section by its title', () => {
    render(<Host />);
    expect(screen.getByRole('region', { name: 'Access' })).toBeTruthy();
  });

  it('shows no chips when there are no entries', () => {
    render(<Host />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('shows one chip per entry labelled content and access', () => {
    render(<Host initial={[FILES_READ, PROMPTS_RW]} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Files: Read'),
      expect.stringContaining('Prompts: Read&Write'),
    ]);
  });

  it('gives every chip the tiny typography class and the chip colour class', () => {
    render(
      <Host
        initial={[FILES_READ]}
        readOnlyChips={[{ id: 'p', label: 'Policies: Read' }]}
      />,
    );
    for (const title of ['Files: Read', 'Policies: Read']) {
      const label = screen.getByTitle(title);
      /* The kit puts the title on the label inside the tag; the classes sit on the tag itself. */
      // eslint-disable-next-line testing-library/no-node-access
      const chip = label.closest('[class*="dial-tiny-text"]');
      expect(chip).toBeTruthy();
      expect(chip?.className).toMatch(/chip/);
    }
  });

  it('names each remove control after the entry it removes', () => {
    render(<Host initial={[FILES_READ]} />);
    expect(
      screen.getByRole('button', { name: 'Remove Files: Read' }),
    ).toBeTruthy();
  });

  it('removes only the chip whose control is activated, without opening the modal', async () => {
    const onChange = vi.fn();
    render(<Host initial={[FILES_READ, PROMPTS_RW]} onChange={onChange} />);

    await user.click(
      screen.getByRole('button', { name: 'Remove Files: Read' }),
    );

    expect(onChange).toHaveBeenCalledWith([PROMPTS_RW]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chipTexts()).toEqual([
      expect.stringContaining('Prompts: Read&Write'),
    ]);
    expect(chipTexts()).toContainEqual(
      expect.stringContaining('Prompts: Read&Write'),
    );
  });

  it('moves focus to the Configure button after a chip is removed', async () => {
    render(<Host initial={[FILES_READ]} />);

    await user.click(
      screen.getByRole('button', { name: 'Remove Files: Read' }),
    );
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows read-only chips without a remove control', () => {
    render(
      <Host
        initial={[FILES_READ]}
        readOnlyChips={[{ id: 'p', label: 'Policies: Read' }]}
      />,
    );
    expect(screen.getByText('Policies: Read')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Remove Policies/ }),
    ).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(1);
  });

  it('does not list read-only chips in the modal', async () => {
    render(<Host readOnlyChips={[{ id: 'p', label: 'Policies: Read' }]} />);
    await user.click(screen.getByRole('button', { name: 'Configure' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Policies: Read')).toBeNull();
    expect(within(dialog).getAllByRole('group')).toHaveLength(1);
  });

  describe('notice', () => {
    it('is shown while an entry exists', () => {
      render(<Host initial={[FILES_READ]} noticeText="Needs approval" />);
      expect(screen.getByText('Needs approval')).toBeTruthy();
    });

    it('is shown while only a read-only chip exists', () => {
      render(
        <Host
          readOnlyChips={[{ id: 'p', label: 'Policies: Read' }]}
          noticeText="Needs approval"
        />,
      );
      expect(screen.getByText('Needs approval')).toBeTruthy();
    });

    it('is hidden when there are no entries', () => {
      render(<Host noticeText="Needs approval" />);
      expect(screen.queryByText('Needs approval')).toBeNull();
    });

    it('disappears after the last entry is removed', async () => {
      render(<Host initial={[FILES_READ]} noticeText="Needs approval" />);
      await user.click(
        screen.getByRole('button', { name: 'Remove Files: Read' }),
      );
      expect(screen.queryByText('Needs approval')).toBeNull();
    });
  });

  describe('announcements', () => {
    it('mounts the live region before any text is put into it', () => {
      render(<Host />);
      const regions = screen.getAllByRole('status');
      expect(regions.some((region) => region.textContent === '')).toBe(true);
    });

    it('announces a removed entry politely', async () => {
      render(<Host initial={[FILES_READ]} />);
      await user.click(
        screen.getByRole('button', { name: 'Remove Files: Read' }),
      );
      expect(
        screen
          .getAllByRole('status')
          .some((region) => region.textContent === 'Files: Read removed'),
      ).toBe(true);
    });

    it('announces an entry added through the modal', async () => {
      render(<Host />);
      await user.click(screen.getByRole('button', { name: 'Configure' }));
      const [card] = within(screen.getByRole('dialog')).getAllByRole('group');
      await user.click(
        within(card).getByRole('combobox', { name: 'Select content' }),
      );
      await user.click(await screen.findByRole('option', { name: 'Files' }));
      await user.click(
        within(card).getByRole('combobox', { name: 'Select access' }),
      );
      await user.click(await screen.findByRole('option', { name: 'Read' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(
        screen
          .getAllByRole('status')
          .some((region) => region.textContent === 'Files: Read added'),
      ).toBe(true);
    });
  });

  describe('modal', () => {
    it('opens from the Configure button and saves the draft into the value', async () => {
      const onChange = vi.fn();
      render(<Host onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Configure' }));
      const [card] = within(screen.getByRole('dialog')).getAllByRole('group');
      await user.click(
        within(card).getByRole('combobox', { name: 'Select content' }),
      );
      await user.click(await screen.findByRole('option', { name: 'Prompts' }));
      await user.click(
        within(card).getByRole('combobox', { name: 'Select access' }),
      );
      await user.click(
        await screen.findByRole('option', { name: 'Read&Write' }),
      );

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onChange).toHaveBeenCalledWith([PROMPTS_RW]);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(chipTexts()).toContainEqual(
        expect.stringContaining('Prompts: Read&Write'),
      );
    });

    it('leaves the value unchanged on Cancel', async () => {
      const onChange = vi.fn();
      render(<Host initial={[FILES_READ]} onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Configure' }));
      await user.click(
        screen.getByRole('button', { name: 'Delete access 1: Files' }),
      );

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onChange).not.toHaveBeenCalled();
      expect(chipTexts()).toContainEqual(
        expect.stringContaining('Files: Read'),
      );
    });

    it('discards the draft on Escape and returns focus to the Configure button', async () => {
      const onChange = vi.fn();
      render(<Host initial={[FILES_READ]} onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Configure' }));
      await user.click(
        screen.getByRole('button', { name: 'Delete access 1: Files' }),
      );

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('returns focus to the Configure button after saving', async () => {
      render(<Host initial={[FILES_READ]} />);
      await user.click(screen.getByRole('button', { name: 'Configure' }));

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  it('uses the supplied labels', () => {
    render(
      <AccessField
        value={[FILES_READ]}
        onChange={vi.fn()}
        contentOptions={options}
        labels={{
          ...DEFAULT_ACCESS_FIELD_LABELS,
          title: 'Zugriff',
          configureLabel: 'Konfigurieren',
          accessRead: 'Lesen',
          removeEntry: (label) => `${label} entfernen`,
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Zugriff' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Konfigurieren' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Files: Lesen entfernen' }),
    ).toBeTruthy();
  });
});
