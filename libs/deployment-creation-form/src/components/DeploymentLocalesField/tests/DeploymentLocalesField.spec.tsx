import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '../../../models/deployment-creation-form';
import { DeploymentLocalesField } from '../DeploymentLocalesField';

const labels: DeploymentCreationFormLocaleLabels = {
  summaryLabel: 'Locales',
  editLabel: 'Edit',
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

  it('renders a placeholder when no additional locales are configured', () => {
    renderField();
    expect(screen.getByText('Locales: —')).toBeTruthy();
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

  it('opens the add-locale popup when Edit is clicked', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Add locale' })).toBeTruthy();
  });

  it('adds a new empty row when "Add locale" is clicked', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    expect(screen.getByRole('group', { name: 'Locale 1' })).toBeTruthy();
  });

  it('disables save while a row has no name', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
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
    await user.click(screen.getByRole('button', { name: 'Edit' }));
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
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete locale 1' }));
    expect(screen.queryByRole('group', { name: 'Locale 1' })).toBeNull();
  });

  it('discards edits when the popup is cancelled', async () => {
    const onChange = vi.fn();
    renderField([], onChange);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    // Reopening with no saved value re-seeds a single unconfigured row, not
    // the two rows added-then-discarded in the previous open.
    expect(screen.getAllByRole('group', { name: 'Locale 1' })).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Locale 2' })).toBeNull();
  });

  it('disables "Add locale" once every available language is used', async () => {
    renderField();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    await user.click(screen.getByRole('button', { name: 'Add locale' }));
    expect(
      screen
        .getByRole('button', { name: 'Add locale' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
