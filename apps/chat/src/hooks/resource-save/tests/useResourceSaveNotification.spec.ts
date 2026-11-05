import {
  ResourceSaveOutcome,
  SaveDestinationRoot,
  type ResourceSaveChoice,
  type ResourceSaveResult,
} from '@epam/ai-dial-chat-hooks';
import { SaveVersionMode } from '@epam/ai-dial-publish-panel';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { NotifiableEntity } from '../../../types/entity-notification';
import { useResourceSaveNotification } from '../useResourceSaveNotification';

vi.mock('../../../context/NotificationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));

const showNotification = vi.fn();

const makeResult = (
  overrides: Partial<ResourceSaveResult> = {},
): ResourceSaveResult => ({
  outcome: ResourceSaveOutcome.Saved,
  savedId: 'applications/b1/agent__1.0.0',
  isCreated: false,
  isNewVersion: false,
  isPublished: false,
  ...overrides,
});

const choice: ResourceSaveChoice = {
  resourceId: 'applications/b1/agent__1.0.0',
  currentFolderPath: [],
  currentVersion: '1.0.0',
  destination: { rootKey: SaveDestinationRoot.Personal, path: [] },
  versionMode: SaveVersionMode.Keep,
  newVersion: '1.1.0',
};

const renderNotify = () =>
  renderHook(() =>
    useResourceSaveNotification({
      resourceName: 'Agent',
      notifiableEntity: NotifiableEntity.QuickApp,
    }),
  ).result.current;

describe('useResourceSaveNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
  });

  it('confirms an in-place save as a success', () => {
    renderNotify()(makeResult(), choice);
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: NotificationVariant.Success }),
    );
  });

  it('names the new version that was saved', () => {
    renderNotify()(makeResult({ isNewVersion: true }), choice);
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Success,
        message: `${ResourceSavePanelI18nKeys.NewVersionSaved}|${JSON.stringify({ name: 'Agent', version: '1.1.0' })}`,
      }),
    );
  });

  it('names the Personal root when a move to it fails', () => {
    renderNotify()(
      makeResult({ outcome: ResourceSaveOutcome.SavedButMoveFailed }),
      choice,
    );
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: `${ResourceSavePanelI18nKeys.SavedButMoveFailed}|${JSON.stringify({ name: 'Agent', folder: CatalogI18nKeys.FolderPersonal })}`,
      }),
    );
  });

  it('names the last folder segment when a move to a Personal subfolder fails', () => {
    renderNotify()(
      makeResult({ outcome: ResourceSaveOutcome.SavedButMoveFailed }),
      {
        ...choice,
        destination: {
          rootKey: SaveDestinationRoot.Personal,
          path: ['Work', 'Drafts'],
        },
      },
    );
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `${ResourceSavePanelI18nKeys.SavedButMoveFailed}|${JSON.stringify({ name: 'Agent', folder: 'Drafts' })}`,
      }),
    );
  });

  it('reports a failed publish after a successful save as an error', () => {
    renderNotify()(
      makeResult({ outcome: ResourceSaveOutcome.SavedButPublishFailed }),
      choice,
    );
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: `${ResourceSavePanelI18nKeys.SavedButPublishFailed}|${JSON.stringify({ name: 'Agent' })}`,
      }),
    );
  });
});
