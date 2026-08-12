import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../context/NotificationContext';
import { createNotificationContextValue } from '../../context/tests/notification-context-mock';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ENTITY_OPERATION_NOTIFICATIONS } from '../../utils/entity-notification';
import { useOperationNotification } from '../useOperationNotification';

vi.mock('../../context/NotificationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));

const mockShowNotification = vi.fn();

const renderNotifier = () => {
  const { result } = renderHook(() => useOperationNotification());
  return result;
};

/* Every (entity, operation) pair the map declares, as flat test rows. */
const mappedPairs = Object.entries(ENTITY_OPERATION_NOTIFICATIONS).flatMap(
  ([entity, operations]) =>
    Object.entries(operations).map(
      ([operation, keys]) =>
        [entity, operation, keys] as [
          NotifiableEntity,
          EntityOperation,
          { titleKey: string; messageKey: string },
        ],
    ),
);

describe('useOperationNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  it.each(mappedPairs)(
    'notifies %s %s from its mapped keys',
    (entity, operation, keys) => {
      const result = renderNotifier();

      const params = {
        name: 'Meeting Notes Summarizer',
        folder: 'Folder name',
      };
      const interpolated = JSON.stringify(params);

      result.current.notifyOperationSuccess(entity, operation as never, params);

      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        title: `${keys.titleKey}|${interpolated}`,
        message: `${keys.messageKey}|${interpolated}`,
      });
    },
  );

  it('interpolates the entity name into the body', () => {
    const result = renderNotifier();

    result.current.notifyOperationSuccess(
      NotifiableEntity.Prompt,
      EntityOperation.Downloaded,
      { name: 'Weekly digest' },
    );

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title:
          'entityNotifications.prompt.downloadedTitle|{"name":"Weekly digest"}',
        message:
          'entityNotifications.prompt.downloaded|{"name":"Weekly digest"}',
      }),
    );
  });

  it('interpolates the target folder for a publish request', () => {
    const result = renderNotifier();

    result.current.notifyOperationSuccess(
      NotifiableEntity.Toolset,
      EntityOperation.PublishRequested,
      { name: 'Jira tools', folder: 'Shared/Ops' },
    );

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'entityNotifications.toolset.publishRequested|{"name":"Jira tools","folder":"Shared/Ops"}',
      }),
    );
  });

  it('passes the item count so a plural pair can pick its variant', () => {
    const result = renderNotifier();

    result.current.notifyOperationSuccess(
      NotifiableEntity.File,
      EntityOperation.Downloaded,
      { name: 'files.zip', count: 3 },
    );

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title:
          'entityNotifications.file.downloadedTitle|{"name":"files.zip","count":3}',
        message:
          'entityNotifications.file.downloaded|{"name":"files.zip","count":3}',
      }),
    );
  });

  it('never sets a requestId — trace ids belong to error notifications', () => {
    const result = renderNotifier();

    result.current.notifyOperationSuccess(
      NotifiableEntity.Folder,
      EntityOperation.Created,
      { name: 'Reports' },
    );

    expect(mockShowNotification).toHaveBeenCalledOnce();
    expect(mockShowNotification.mock.calls[0][0]).not.toHaveProperty(
      'requestId',
    );
  });

  it('rejects an (entity, operation) pair that has no copy', () => {
    const result = renderNotifier();

    result.current.notifyOperationSuccess(
      NotifiableEntity.Model,
      // @ts-expect-error a model cannot be created from the UI, so no copy exists
      EntityOperation.Created,
      { name: 'gpt-4o' },
    );

    /*
     * The guarantee under test is the compile error above. At runtime the call is a
     * no-op instead of a throw: the operation it reports on has already succeeded.
     */
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});
