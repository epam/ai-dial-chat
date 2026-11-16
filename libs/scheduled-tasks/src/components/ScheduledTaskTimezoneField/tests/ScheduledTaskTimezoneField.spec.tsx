import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskTimezoneOption } from '../../../models/scheduled-task-timezone-props';
import { ScheduledTaskTimezoneField } from '../ScheduledTaskTimezoneField';

const isPhoneMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsPhone: isPhoneMock,
}));

const option = (
  id: string,
  offsetLabel: string,
  offsetMinutes: number,
  abbreviation?: string,
  extraTerms: string[] = [],
): ScheduledTaskTimezoneOption => ({
  id,
  offsetLabel,
  offsetMinutes,
  ...(abbreviation ? { abbreviation } : {}),
  searchTerms: [
    offsetLabel.toLowerCase(),
    id.toLowerCase(),
    id.replace(/[_/]/g, ' ').toLowerCase(),
    ...(abbreviation ? [abbreviation.toLowerCase()] : []),
    ...extraTerms,
  ],
});

const OPTIONS = [
  option('America/St_Johns', 'GMT-03:30', -210),
  option('Atlantic/Bermuda', 'GMT-04:00', -240),
  option('Atlantic/Cape_Verde', 'GMT-01:00', -60),
  option('Africa/Tunis', 'GMT+01:00', 60, 'CET', ['cest']),
  option('Europe/Berlin', 'GMT+01:00', 60, 'CET', ['cest']),
  option('Asia/Tehran', 'GMT+03:30', 210),
  option('UTC', 'GMT+00:00', 0),
];

const Harness = ({
  initial = 'Europe/Berlin',
  onChange,
  browser = 'Europe/Berlin',
}: {
  initial?: string;
  onChange?: (id: string) => void;
  browser?: string;
}): ReactElement => {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <ScheduledTaskTimezoneField
        id="tz-link"
        options={OPTIONS}
        value={value}
        browserTimezoneId={browser}
        onChange={(id) => {
          setValue(id);
          onChange?.(id);
        }}
      />
      <output aria-label="selected zone">{value}</output>
    </div>
  );
};

const openPicker = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /change timezone/i }));
  return user;
};

describe('ScheduledTaskTimezoneField', () => {
  beforeEach(() => {
    isPhoneMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the link closed by default', () => {
    render(<Harness />);

    const link = screen.getByRole('button', { name: /change timezone/i });
    expect(link.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a named dialog with focus in the search field', async () => {
    render(<Harness />);

    await openPicker();

    const dialog = await screen.findByRole('dialog', { name: 'Time zone' });
    const search = within(dialog).getByRole('textbox', {
      name: 'Search time zones',
    });
    expect(search.matches(':focus')).toBe(true);
  });

  it('lists the browser zone first under its own heading, then every zone', async () => {
    render(<Harness />);

    await openPicker();

    const groups = await screen.findAllByRole('group');
    expect(
      groups.map((group) => group.getAttribute('aria-labelledby')),
    ).toHaveLength(2);
    const [yourZone, allZones] = groups;
    expect(within(yourZone).getByText('Your time zone')).toBeTruthy();
    expect(within(yourZone).getAllByRole('option')).toHaveLength(1);
    expect(within(allZones).getByText('All time zones')).toBeTruthy();
    expect(within(allZones).getAllByRole('option')).toHaveLength(
      OPTIONS.length,
    );
  });

  it('keeps the order the host supplies', async () => {
    render(<Harness />);

    await openPicker();

    const rows = await screen.findAllByRole('option');
    const names = rows.slice(1).map((row) => row.textContent);
    expect(names[0]).toContain('America/St_Johns');
    expect(names[names.length - 1]).toContain('UTC');
  });

  it('marks the selected row', async () => {
    render(<Harness initial="Asia/Tehran" />);

    await openPicker();

    const selected = (await screen.findAllByRole('option')).filter(
      (row) => row.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain('Asia/Tehran');
  });

  it('renders the row as offset, identifier and abbreviation', async () => {
    render(<Harness />);

    await openPicker();

    const rows = await screen.findAllByRole('option');
    const berlin = rows.find((row) =>
      row.textContent?.includes('Europe/Berlin'),
    );
    expect(berlin?.textContent).toBe('GMT+01:00Europe/Berlin•CET');
  });

  it('omits the bullet for a zone with no abbreviation', async () => {
    render(<Harness />);

    await openPicker();

    const rows = await screen.findAllByRole('option');
    const tehran = rows.find((row) => row.textContent?.includes('Asia/Tehran'));
    expect(tehran?.textContent).toBe('GMT+03:30Asia/Tehran');
  });

  it('filters by city and highlights the match', async () => {
    render(<Harness />);
    const user = await openPicker();

    await user.type(await screen.findByRole('textbox'), 'Ber');

    const rows = screen.getAllByRole('option');
    expect(rows.map((row) => row.textContent)).toEqual([
      'GMT-04:00Atlantic/Bermuda',
      'GMT+01:00Europe/Berlin•CET',
    ]);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getAllByText('Ber').length).toBeGreaterThanOrEqual(2);
  });

  it('filters by an offset fragment', async () => {
    render(<Harness />);
    const user = await openPicker();

    await user.type(await screen.findByRole('textbox'), '3:30');

    expect(screen.getAllByRole('option').map((row) => row.textContent)).toEqual(
      ['GMT-03:30America/St_Johns', 'GMT+03:30Asia/Tehran'],
    );
  });

  it('finds a zone by a seasonal abbreviation it does not currently show', async () => {
    render(<Harness />);
    const user = await openPicker();

    await user.type(await screen.findByRole('textbox'), 'CEST');

    expect(screen.getAllByRole('option').map((row) => row.textContent)).toEqual(
      ['GMT+01:00Africa/Tunis•CET', 'GMT+01:00Europe/Berlin•CET'],
    );
  });

  it('announces the result count through a live region mounted before the text', async () => {
    render(<Harness />);
    const user = await openPicker();
    const panel = await screen.findByRole('dialog');
    const regions = within(panel).getAllByRole('status');
    const counter = regions.find((region) => region.textContent === '');

    await user.type(within(panel).getByRole('textbox'), 'Ber');

    expect(counter).toBeTruthy();
    expect(counter?.isConnected).toBe(true);
    expect(counter?.textContent).toBe('2 time zones found');
  });

  it('shows an announced empty state when nothing matches', async () => {
    render(<Harness />);
    const user = await openPicker();

    await user.type(await screen.findByRole('textbox'), 'zzz');

    expect(screen.getByText('No time zones found')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('selects a row by click and closes the picker', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = await openPicker();

    const rows = await screen.findAllByRole('option');
    await user.click(
      rows.find((row) => row.textContent?.includes('Asia/Tehran'))!,
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('Asia/Tehran');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('selected zone').textContent).toBe(
      'Asia/Tehran',
    );
  });

  it('selects with the keyboard: type, ArrowDown, Enter', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = await openPicker();

    await user.type(await screen.findByRole('textbox'), 'Berlin');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('Europe/Berlin');
  });

  it('moves between rows with the arrow keys and back to the search field', async () => {
    render(<Harness />);
    const user = await openPicker();
    const search = await screen.findByRole('textbox');
    await user.type(search, 'Atlantic');

    await user.keyboard('{ArrowDown}');
    const rows = screen.getAllByRole('option');
    expect(rows[0].matches(':focus')).toBe(true);
    await user.keyboard('{ArrowDown}');
    expect(rows[1].matches(':focus')).toBe(true);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(search.matches(':focus')).toBe(true);
  });

  it('closes on Escape without changing the zone and returns focus to the link', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = await openPicker();
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: /change timezone/i })
        .matches(':focus'),
    ).toBe(true);
  });

  it('starts with an empty search each time it opens', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.type(await screen.findByRole('textbox'), 'Ber');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /change timezone/i }));

    expect(
      ((await screen.findByRole('textbox')) as HTMLInputElement).value,
    ).toBe('');
  });

  it('does not open while disabled', async () => {
    render(
      <ScheduledTaskTimezoneField
        id="tz-link"
        options={OPTIONS}
        value="UTC"
        onChange={vi.fn()}
        disabled
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /change timezone/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses host labels in place of the English defaults', async () => {
    render(
      <ScheduledTaskTimezoneField
        id="tz-link"
        options={OPTIONS}
        value="UTC"
        onChange={vi.fn()}
        labels={{ changeLabel: 'Zeitzone ändern', dialogAriaLabel: 'Zeitzone' }}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /zeitzone ändern/i }));

    expect(
      await screen.findByRole('dialog', { name: 'Zeitzone' }),
    ).toBeTruthy();
  });

  it('applies host colors as custom properties on the panel and the link wrapper', async () => {
    render(
      <ScheduledTaskTimezoneField
        id="tz-link"
        options={OPTIONS}
        value="UTC"
        onChange={vi.fn()}
        colors={{
          offsetColor: 'rgb(1, 2, 3)',
          linkColor: 'rgb(4, 5, 6)',
          shadowColor: 'rgb(7, 8, 9)',
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /change timezone/i }));

    const dialog = await screen.findByRole('dialog');
    /* CSS custom properties have no accessible query. */
    // eslint-disable-next-line testing-library/no-node-access
    const panel = dialog.querySelector<HTMLElement>('[style*="--stz-offset"]');
    expect(panel?.style.getPropertyValue('--stz-offset')).toBe('rgb(1, 2, 3)');
    expect(dialog.style.getPropertyValue('--stz-shadow')).toBe('rgb(7, 8, 9)');
    expect(
      screen
        .getByRole('button', { name: /change timezone/i })
        // eslint-disable-next-line testing-library/no-node-access
        .closest<HTMLElement>('[style*="--stz-link"]')
        ?.style.getPropertyValue('--stz-link'),
    ).toBe('rgb(4, 5, 6)');
  });
});

describe('ScheduledTaskTimezoneField — phone', () => {
  beforeEach(() => {
    isPhoneMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the picker in a bottom sheet and selects a zone', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /change timezone/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Time zone' });
    const rows = within(sheet).getAllByRole('option');
    await user.click(
      rows.find((row) => row.textContent?.includes('Asia/Tehran'))!,
    );

    expect(onChange).toHaveBeenCalledWith('Asia/Tehran');
  });
});

describe('ScheduledTaskTimezoneField — right-to-left', () => {
  beforeEach(() => {
    isPhoneMock.mockReturnValue(false);
    document.documentElement.setAttribute('dir', 'rtl');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    vi.clearAllMocks();
  });

  it('opens, filters and selects the same way under dir=rtl', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /change timezone/i }));
    await user.type(await screen.findByRole('textbox'), 'Tehran');
    await user.click(screen.getByRole('option'));

    expect(onChange).toHaveBeenCalledWith('Asia/Tehran');
  });
});
