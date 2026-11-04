import {
  PublicationRuleFunction,
  SaveVersionMode,
} from '@epam/ai-dial-publish-panel';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceSavePanelI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import type { ResourceSaveAdapter } from '../../../models/resource-save';
import { NotifiableEntity } from '../../../types/entity-notification';
import {
  ResourceSaveOutcome,
  SaveDestinationRoot,
} from '../../../types/resource-save';
import {
  useResourceSavePanel,
  type UseResourceSavePanelParams,
} from '../useResourceSavePanel';

vi.mock('../../../context/NotificationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));

const showNotification = vi.fn();
const ID = 'applications/b1/agent__1.0.0';

const makeAdapter = (
  overrides: Partial<ResourceSaveAdapter> = {},
): ResourceSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: vi.fn().mockResolvedValue({ id: ID }),
  saveAsNewVersion: vi
    .fn()
    .mockResolvedValue({ id: 'applications/b1/agent__1.1.0' }),
  move: vi.fn(),
  ...overrides,
});

const renderPanel = (overrides: Partial<UseResourceSavePanelParams> = {}) => {
  const params: UseResourceSavePanelParams = {
    isOpen: true,
    adapter: makeAdapter(),
    resourceId: ID,
    currentFolderPath: [],
    resourceName: 'Agent',
    currentVersion: '1.0.0',
    notifiableEntity: NotifiableEntity.QuickApp,
    publish: vi.fn().mockResolvedValue(undefined),
    rememberPublishFolder: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook(() => useResourceSavePanel(params)) };
};

describe('useResourceSavePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
  });

  it('starts at the current Personal folder, keeping the version', () => {
    const { result } = renderPanel({ currentFolderPath: ['Design'] });
    expect(result.current.destination).toEqual({
      rootKey: SaveDestinationRoot.Personal,
      path: ['Design'],
    });
    expect(result.current.versionMode).toBe(SaveVersionMode.Keep);
    expect(result.current.isSubmitDisabled).toBe(false);
  });

  it('saves in place, notifies the edit and reports the result', async () => {
    const { result, params } = renderPanel();
    await act(() => result.current.submit());

    expect(params.adapter.saveInPlace).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: NotificationVariant.Success }),
    );
    expect(params.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: ResourceSaveOutcome.Saved }),
    );
  });

  it('blocks Save and shows an error for an invalid new version once visited', () => {
    const { result } = renderPanel();
    act(() => result.current.setVersionMode(SaveVersionMode.New));
    act(() => result.current.setNewVersion('abc'));

    expect(result.current.isSubmitDisabled).toBe(true);
    expect(result.current.newVersionError).toBeUndefined();

    act(() => result.current.markNewVersionTouched());
    expect(result.current.newVersionError).toBe(
      ResourceSavePanelI18nKeys.VersionInvalid,
    );
  });

  it('rejects the current version as the new one', () => {
    const { result } = renderPanel();
    act(() => result.current.setVersionMode(SaveVersionMode.New));
    act(() => result.current.setNewVersion('1.0.0'));
    act(() => result.current.markNewVersionTouched());

    expect(result.current.newVersionError).toBe(
      `${ResourceSavePanelI18nKeys.VersionUnchanged}|${JSON.stringify({ version: '1.0.0' })}`,
    );
  });

  it('shows a 409 as an existing version and keeps the panel open', async () => {
    const conflict = Object.assign(new Error('taken'), {
      response: new Response(null, { status: 409 }),
    });
    const adapter = makeAdapter({
      saveAsNewVersion: vi.fn().mockRejectedValue(conflict),
    });
    const { result, params } = renderPanel({ adapter });
    act(() => result.current.setVersionMode(SaveVersionMode.New));
    act(() => result.current.setNewVersion('1.1.0'));

    await act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.newVersionError).toBe(
        `${ResourceSavePanelI18nKeys.VersionExists}|${JSON.stringify({ version: '1.1.0' })}`,
      ),
    );
    expect(params.onSaved).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('announces a failed first step and does not report a save', async () => {
    const adapter = makeAdapter({
      saveInPlace: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { result, params } = renderPanel({ adapter });

    await act(() => result.current.submit());

    expect(result.current.submitError).toBeTruthy();
    expect(params.onSaved).not.toHaveBeenCalled();
  });

  it('publishes to an Organization folder and remembers it', async () => {
    const { result, params } = renderPanel();
    act(() =>
      result.current.setDestination({
        rootKey: SaveDestinationRoot.Organization,
        path: ['EPAM'],
      }),
    );

    await act(() => result.current.submit());

    expect(params.publish).toHaveBeenCalledWith(
      'application',
      ID,
      ['EPAM'],
      '1.0.0',
      [],
    );
    expect(params.rememberPublishFolder).toHaveBeenCalledWith(['EPAM']);
  });

  it('loads the pending Organization folder rules once and publishes the edited ones', async () => {
    const existing = {
      source: 'roles',
      function: PublicationRuleFunction.Equal,
      targets: ['dev'],
    };
    const edited = { ...existing, targets: ['qa'] };
    const fetchRules = vi.fn().mockResolvedValue([existing]);
    const { result, params } = renderPanel({ fetchRules });
    const epam = { rootKey: SaveDestinationRoot.Organization, path: ['EPAM'] };

    act(() => result.current.setPendingDestination(epam));
    await waitFor(() => expect(result.current.rules).toEqual([existing]));
    expect(fetchRules).toHaveBeenCalledWith(['EPAM']);

    act(() => result.current.setRules([edited]));
    act(() =>
      result.current.setPendingDestination({
        rootKey: SaveDestinationRoot.Personal,
        path: [],
      }),
    );
    act(() => result.current.setPendingDestination(epam));
    expect(fetchRules).toHaveBeenCalledOnce();
    expect(result.current.rules).toEqual([edited]);

    act(() => result.current.setDestination(epam));
    await act(() => result.current.submit());
    expect(params.publish).toHaveBeenCalledWith(
      'application',
      ID,
      ['EPAM'],
      '1.0.0',
      [edited],
    );
  });

  it('flags a failed rules fetch', async () => {
    const { result } = renderPanel({
      fetchRules: vi.fn().mockRejectedValue(new Error('boom')),
    });
    act(() =>
      result.current.setPendingDestination({
        rootKey: SaveDestinationRoot.Organization,
        path: ['EPAM'],
      }),
    );
    await waitFor(() => expect(result.current.hasRulesLoadError).toBe(true));
    expect(result.current.isRulesLoading).toBe(false);
  });

  it('reports a failed publish after a successful save with an error notification', async () => {
    const { result, params } = renderPanel({
      publish: vi.fn().mockRejectedValue(new Error('denied')),
    });
    act(() =>
      result.current.setDestination({
        rootKey: SaveDestinationRoot.Organization,
        path: ['EPAM'],
      }),
    );

    await act(() => result.current.submit());

    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: `${ResourceSavePanelI18nKeys.SavedButPublishFailed}|${JSON.stringify({ name: 'Agent' })}`,
      }),
    );
    expect(params.rememberPublishFolder).not.toHaveBeenCalled();
    expect(params.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: ResourceSaveOutcome.SavedButPublishFailed,
      }),
    );
  });
});
