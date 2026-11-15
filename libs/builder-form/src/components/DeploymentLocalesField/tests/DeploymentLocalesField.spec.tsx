import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '../../../models/deployment-creation-form';
import { DeploymentLocalesField } from '../DeploymentLocalesField';

const labels: DeploymentCreationFormLocaleLabels = {
  summaryLabel: 'Locales',
  addLabel: 'Add locales',
  editLabel: 'Edit locales',
  popupTitle: 'Add locale',
  addLocaleLabel: 'Add locale',
  languageLabel: 'Language',
  nameLabel: 'Name',
  namePlaceholder: 'Enter name',
  descriptionLabel: 'About',
  descriptionPlaceholder: 'Enter brief description',
  deleteAriaLabel: 'Delete locale',
  cancelLabel: 'Cancel',
  saveLabel: 'Save',
};

const availableLocaleOptions: DeploymentCreationFormLocaleOption[] = [
  { code: 'de', label: 'DE' },
  { code: 'fr', label: 'FR' },
];

const renderField = (
  value: DeploymentCreationFormLocaleEntry[] = [],
  onChange = vi.fn(),
) =>
  render(
    <DeploymentLocalesField
      value={value}
      onChange={onChange}
      availableLocaleOptions={availableLocaleOptions}
      labels={labels}
    />,
  );

describe('DeploymentLocalesField', () => {
  const user = userEvent.setup({ delay: null });

  it('renders nothing when there are no selectable languages', () => {
    const { container } = render(
      <DeploymentLocalesField
        value={[]}
        onChange={vi.fn()}
        availableLocaleOptions={[]}
        labels={labels}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('marks both the language and the name field as required', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    expect(
      screen.getByRole('combobox', { name: 'Language (required)' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'Name (required)' }),
    ).toBeTruthy();
  });

  it('hides the summary text when no additional locales are configured', () => {
    renderField();
    expect(screen.queryByText(/Locales:/)).toBeNull();
  });

  it('renders the configured locale codes in the summary', () => {
    renderField([
      {
        id: 'locale-de',
        language: 'de',
        name: 'Mein Toolset',
        description: '',
      },
    ]);
    expect(screen.getByText('Locales: [DE]')).toBeTruthy();
  });

  it('shows "Add locales" and opens the popup when clicked, given no configured locales', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    expect(screen.getByRole('heading', { name: 'Add locale' })).toBeTruthy();
  });

  it('shows "Edit locales" once at least one locale is configured', () => {
    renderField([
      {
        id: 'locale-de',
        language: 'de',
        name: 'Mein Toolset',
        description: '',
      },
    ]);
    expect(screen.getByRole('button', { name: 'Edit locales' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add locales' })).toBeNull();
  });

  it('adds a new empty row when "Add locale" is clicked', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    expect(screen.getByRole('group', { name: 'Locale 1' })).toBeTruthy();
  });

  it('disables save while a row has no name', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('calls onChange with only fully-filled rows when saved', async () => {
    const onChange = vi.fn();
    renderField(
      [
        {
          id: 'locale-de',
          language: 'de',
          name: 'Mein Toolset',
          description: '',
        },
      ],
      onChange,
    );
    await user.click(screen.getByRole('button', { name: 'Edit locales' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'locale-de',
        language: 'de',
        name: 'Mein Toolset',
        description: '',
      },
    ]);
  });

  it('removes a row when its delete button is clicked', async () => {
    renderField([
      {
        id: 'locale-de',
        language: 'de',
        name: 'Mein Toolset',
        description: '',
      },
    ]);
    await user.click(screen.getByRole('button', { name: 'Edit locales' }));
    await user.click(screen.getByRole('button', { name: 'Delete locale 1' }));
    expect(screen.queryByRole('group', { name: 'Locale 1' })).toBeNull();
  });

  it('discards edits when the popup is cancelled', async () => {
    const onChange = vi.fn();
    renderField([], onChange);
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    // Reopening with no saved value re-seeds a single unconfigured row, not
    // the two rows added-then-discarded in the previous open.
    expect(screen.getAllByRole('group', { name: 'Locale 1' })).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Locale 2' })).toBeNull();
  });

  it('disables "Add locale" once every available language is used', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add locales' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    expect(
      screen
        .getByRole('button', { name: 'Add locale' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  describe('retained entries', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const italianEntry: DeploymentCreationFormLocaleEntry = {
      id: 'locale-it',
      language: 'it',
      name: 'Il mio toolset',
      description: '',
    };

    const renderRetained = ({
      options = [{ code: 'de', label: 'Deutsch' }],
      value = [italianEntry],
      onChange = vi.fn(),
      dir,
    }: {
      options?: DeploymentCreationFormLocaleOption[];
      value?: DeploymentCreationFormLocaleEntry[];
      onChange?: (entries: DeploymentCreationFormLocaleEntry[]) => void;
      dir?: 'ltr' | 'rtl';
    } = {}) =>
      render(
        <div dir={dir}>
          <DeploymentLocalesField
            value={value}
            onChange={onChange}
            availableLocaleOptions={options}
            formatLocaleLabel={(code) => (code === 'it' ? 'italiano' : code)}
            labels={labels}
          />
        </div>,
      );

    it('keeps the control visible with "Add locale" disabled when only a retained entry exists', async () => {
      const onChange = vi.fn();
      renderRetained({ options: [], onChange });

      expect(screen.getByText('Locales: [IT]')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Edit locales' }));
      expect(
        screen
          .getByRole('button', { name: 'Add locale' })
          .hasAttribute('disabled'),
      ).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('labels the retained code through formatLocaleLabel and never offers it to a new row', async () => {
      /* jsdom has no IntersectionObserver; the kit dropdown list observes its items. */
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          observe = vi.fn();
          unobserve = vi.fn();
          disconnect = vi.fn();
        },
      );
      renderRetained();
      await user.click(screen.getByRole('button', { name: 'Edit locales' }));

      const retainedRow = screen.getByRole('group', { name: 'Locale 1' });
      expect(
        within(retainedRow).getByRole<HTMLInputElement>('combobox', {
          name: 'Language (required)',
        }).value,
      ).toBe('italiano');

      await user.click(screen.getByRole('button', { name: 'Add locale' }));
      const newRow = screen.getByRole('group', { name: 'Locale 2' });
      await user.click(
        within(newRow).getByRole('combobox', { name: 'Language (required)' }),
      );
      const offered = screen
        .getAllByRole('option')
        .map((option) => option.textContent);
      expect(offered).toContain('Deutsch');
      expect(offered).not.toContain('italiano');
      expect(
        within(newRow).getByRole<HTMLInputElement>('combobox', {
          name: 'Language (required)',
        }).value,
      ).toBe('Deutsch');
    });

    it('does not count a retained row toward the "Add locale" limit', async () => {
      renderRetained();
      await user.click(screen.getByRole('button', { name: 'Edit locales' }));

      const addLocale = screen.getByRole('button', { name: 'Add locale' });
      expect(addLocale.hasAttribute('disabled')).toBe(false);
      await user.click(addLocale);
      expect(
        screen
          .getByRole('button', { name: 'Add locale' })
          .hasAttribute('disabled'),
      ).toBe(true);
    });

    it('saves without the retained entry once it is deleted', async () => {
      const onChange = vi.fn();
      renderRetained({ options: [], onChange });
      await user.click(screen.getByRole('button', { name: 'Edit locales' }));
      await user.click(screen.getByRole('button', { name: 'Delete locale 1' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('shows codes in the summary when options carry language names', () => {
      renderRetained({
        value: [{ ...italianEntry, id: 'locale-de', language: 'de' }],
      });
      expect(screen.getByText('Locales: [DE]')).toBeTruthy();
    });

    it('keeps the accessible name of a retained row select in RTL', async () => {
      renderRetained({ dir: 'rtl' });
      await user.click(screen.getByRole('button', { name: 'Edit locales' }));

      expect(
        within(screen.getByRole('group', { name: 'Locale 1' })).getByRole(
          'combobox',
          { name: 'Language (required)' },
        ),
      ).toBeTruthy();
    });
  });
});
