import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../../types/entity-type';
import {
  CredentialsLevel,
  CredentialStatus,
} from '../../../../../types/toolset-auth';
import { CredentialsApiKeyOverlay } from '../CredentialsApiKeyOverlay';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Input: ({
    onChange,
    labelProps,
    disabled,
  }: {
    onChange: (value?: string) => void;
    labelProps?: { label?: string };
    disabled?: boolean;
  }) => (
    <input
      aria-label={labelProps?.label}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  NeutralButton: ({
    label,
    onClick,
    disabled,
    iconBefore,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    iconBefore?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {iconBefore}
      {label}
    </button>
  ),
  LinkButton: ({
    label,
    onClick,
    disabled,
    iconBefore,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    iconBefore?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {iconBefore}
      {label}
    </button>
  ),
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status">{ariaLabel}</span>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconKey: () => <svg />,
}));

const item: CatalogItem = {
  id: '1',
  type: CatalogEntityType.Toolset,
  name: 'sm-github-copilot',
  version: '1.0.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('CredentialsApiKeyOverlay', () => {
  it('renders the personal API key title', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Personal API key')).toBeTruthy();
  });

  it('keeps Add enabled at all times', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onLogin={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('shows a validation error and does not submit when Add is clicked with an empty key', async () => {
    const onLogin = vi.fn();
    const onClose = vi.fn();
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onLogin={onLogin}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('API key is required.')).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears the validation error once the user starts typing', async () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onLogin={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('API key is required.')).toBeTruthy();

    await userEvent.type(screen.getByLabelText('API key'), 's');
    expect(screen.queryByText('API key is required.')).toBeNull();
  });

  it('uses texts.apiKeyRequiredErrorMessage when provided', async () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onLogin={vi.fn()}
        onClose={vi.fn()}
        texts={{ apiKeyRequiredErrorMessage: 'Please enter a key' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Please enter a key')).toBeTruthy();
  });

  it('shows a spinner and disables Add while saving, only closing once the save resolves', async () => {
    const { promise, resolve } = deferred<void>();
    const onLogin = vi.fn(() => promise);
    const onClose = vi.fn();
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedOut}
        onLogin={onLogin}
        onClose={onClose}
      />,
    );

    await userEvent.type(screen.getByLabelText('API key'), 'secret-key');
    const addButton = screen.getByRole('button', { name: 'Add' });
    await userEvent.click(addButton);

    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
      apiKey: 'secret-key',
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(addButton).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.getByText('Adding')).toBeTruthy();

    await act(async () => {
      resolve();
      await promise;
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows only the added confirmation and a Delete action when a key is already on file', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Personal key has been added')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('shows when the key was added as support text below the confirmation', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        apiKeyAddedWhen="3 weeks ago"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Added 3 weeks ago')).toBeTruthy();
  });

  it('omits the support text when apiKeyAddedWhen is absent', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^Added/)).toBeNull();
  });

  it('uses texts.apiKeyAddedLabel to format the support text', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        apiKeyAddedWhen="1 week ago"
        onClose={vi.fn()}
        texts={{ apiKeyAddedLabel: (when) => `Since ${when}` }}
      />,
    );
    expect(screen.getByText('Since 1 week ago')).toBeTruthy();
  });

  it('shows a spinner and disables Delete while removing, only closing once it resolves', async () => {
    const { promise, resolve } = deferred<void>();
    const onLogout = vi.fn(() => promise);
    const onClose = vi.fn();
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        onLogout={onLogout}
        onClose={onClose}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButton);

    expect(onLogout).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(deleteButton).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('Deleting')).toBeTruthy();

    await act(async () => {
      resolve();
      await promise;
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses texts overrides for the title and added-confirmation message', () => {
    render(
      <CredentialsApiKeyOverlay
        item={item}
        level={CredentialsLevel.User}
        status={CredentialStatus.SignedIn}
        onClose={vi.fn()}
        texts={{
          personalApiKeyPanelTitle: 'My key',
          personalApiKeyAddedMessage: 'Key on file',
        }}
      />,
    );
    expect(screen.getByText('My key')).toBeTruthy();
    expect(screen.getByText('Key on file')).toBeTruthy();
  });
});
