import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import {
  ApplicationErrorCode,
  ResourceDependencyAccess,
  ResponseError,
  type ApplicationResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ApplicationAccessContentType,
  ResourceSaveError,
  ApplicationAccessLoadStatus,
} from '@epam/ai-dial-chat-hooks';
import { AccessLevel } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  getApplicationResourceDependencies,
  updateApplicationAccess,
} from '../../../server-api/applications';
import { toApplicationMetadataFields } from '../../../utils/application-editor';
import { useApplicationAccessEditor } from '../useApplicationAccessEditor';

vi.mock('../../../context/NotificationContext');
vi.mock('../../../server-api/applications');

const showNotification = vi.fn();

const metadata: DeploymentCreationFormValues = {
  name: 'App',
  description: '',
  iconUrl: '',
  version: '1.0.0',
  topics: [],
  otherLocales: [],
};

const FILES: ApplicationResourceDependencyDto = {
  linkId: 'f',
  target: { url: 'files/{current-user}/' },
  access: [ResourceDependencyAccess.Read],
};
const POLICIES: ApplicationResourceDependencyDto = {
  linkId: 'p',
  target: { url: 'files/public/policies/' },
  access: [ResourceDependencyAccess.Read],
  required: true,
};

const renderEditor = (
  overrides: Partial<Parameters<typeof useApplicationAccessEditor>[0]> = {},
) =>
  renderHook(() =>
    useApplicationAccessEditor({
      isEnabled: true,
      appId: 'applications/b/app',
      shouldLoad: true,
      failedMessage: 'generic failure',
      ...overrides,
    }),
  );

const refusal = () =>
  new ResponseError(
    new Response(
      JSON.stringify({
        statusCode: 403,
        code: ApplicationErrorCode.ApplicationResourceDependenciesNotAllowed,
        message: 'fixed text',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
  );

describe('useApplicationAccessEditor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(getApplicationResourceDependencies).mockResolvedValue({
      resourceDependencies: [FILES, POLICIES],
    });
    vi.mocked(updateApplicationAccess).mockResolvedValue({ id: 'x' });
  });

  describe('loading the stored list', () => {
    it('is loading first, then holds the stored list as its clean baseline', async () => {
      const { result } = renderEditor();
      expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loading);

      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );
      expect(getApplicationResourceDependencies).toHaveBeenCalledWith(
        'applications/b/app',
      );
      expect(result.current.access.entries).toEqual([
        {
          contentType: ApplicationAccessContentType.Files,
          accessLevel: AccessLevel.Read,
        },
      ]);
      expect(result.current.access.preserved).toHaveLength(1);
      expect(result.current.access.isDirty).toBe(false);
      expect(result.current.hasStoredEntries).toBe(true);
    });

    it('fails, then reads again on retry', async () => {
      vi.mocked(getApplicationResourceDependencies).mockRejectedValueOnce(
        new Error('network'),
      );
      const { result } = renderEditor();
      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Failed),
      );

      act(() => result.current.retry());

      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );
      expect(getApplicationResourceDependencies).toHaveBeenCalledTimes(2);
    });
  });

  describe('save step', () => {
    const load = async () => {
      const view = renderEditor();
      await waitFor(() =>
        expect(view.result.current.status).toBe(
          ApplicationAccessLoadStatus.Loaded,
        ),
      );
      return view;
    };

    it('sends nothing while the draft is untouched', async () => {
      const { result } = await load();

      await expect(
        result.current.save('applications/b/app', metadata),
      ).resolves.toBe(true);

      expect(updateApplicationAccess).not.toHaveBeenCalled();
    });

    it('sends the full list with the current metadata after a change and resets the baseline', async () => {
      const { result } = await load();
      act(() =>
        result.current.access.setEntries([
          {
            contentType: ApplicationAccessContentType.Files,
            accessLevel: AccessLevel.ReadWrite,
          },
          {
            contentType: ApplicationAccessContentType.Prompts,
            accessLevel: AccessLevel.Read,
          },
        ]),
      );

      await act(async () => {
        await result.current.save('applications/b/app', metadata);
      });

      const [id, sentMetadata, list] = vi.mocked(updateApplicationAccess).mock
        .calls[0];
      expect(id).toBe('applications/b/app');
      expect(sentMetadata).toEqual(toApplicationMetadataFields(metadata));
      expect(list.map((entry) => entry.linkId)).toEqual([
        'f',
        'p',
        'access-prompts',
      ]);
      expect(list[1]).toBe(POLICIES);
      expect(result.current.access.isDirty).toBe(false);
    });

    describe('when Core refuses a non-administrator’s change', () => {
      const refuse = async () => {
        const view = await load();
        act(() => view.result.current.access.setEntries([]));
        vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
        return view;
      };

      it('shows a warning, keeps the draft and lets the save carry on', async () => {
        const { result } = await refuse();

        let canCarryOn = false;
        await act(async () => {
          canCarryOn = await result.current.save(
            'applications/b/app',
            metadata,
          );
        });

        expect(canCarryOn).toBe(true);
        expect(showNotification).toHaveBeenCalledOnce();
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: AppsEditorI18nKeys.AccessAdminOnlyError,
            variant: NotificationVariant.Warning,
          }),
        );
        expect(result.current.access.isDirty).toBe(true);
        expect(result.current.access.entries).toEqual([]);
      });

      it('resolves for the panel with the same warning and the draft kept', async () => {
        const { result } = await refuse();

        await act(async () => {
          await expect(
            result.current.saveOrThrow('applications/b/app', metadata),
          ).resolves.toBeUndefined();
        });

        expect(showNotification).toHaveBeenCalledOnce();
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Warning }),
        );
        expect(result.current.access.isDirty).toBe(true);
      });

      it('keeps the baseline, so the next save sends the same list again', async () => {
        const { result } = await refuse();
        await act(async () => {
          await result.current.save('applications/b/app', metadata);
        });

        await act(async () => {
          await result.current.save('applications/b/app', metadata);
        });

        expect(updateApplicationAccess).toHaveBeenCalledTimes(2);
      });
    });

    describe('when the step fails for another reason', () => {
      it('shows one error and reports that the save must stop', async () => {
        const { result } = await load();
        act(() => result.current.access.setEntries([]));
        vi.mocked(updateApplicationAccess).mockRejectedValue(
          new ResponseError(new Response('{}', { status: 500 })),
        );

        let canCarryOn = true;
        await act(async () => {
          canCarryOn = await result.current.save(
            'applications/b/app',
            metadata,
          );
        });

        expect(canCarryOn).toBe(false);
        expect(showNotification).toHaveBeenCalledOnce();
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'generic failure',
            variant: NotificationVariant.Error,
          }),
        );
        expect(result.current.access.isDirty).toBe(true);
      });

      it('rejects for the panel with a ResourceSaveError carrying the message and shows no notification', async () => {
        const { result } = await load();
        act(() => result.current.access.setEntries([]));
        vi.mocked(updateApplicationAccess).mockRejectedValue(
          new ResponseError(new Response('{}', { status: 500 })),
        );

        const error = await result.current
          .saveOrThrow('applications/b/app', metadata)
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ResourceSaveError);
        expect((error as Error).message).toBe('generic failure');
        expect(showNotification).not.toHaveBeenCalled();
        expect(result.current.access.isDirty).toBe(true);
      });
    });

    it('resolves without a request for the panel when the draft is untouched', async () => {
      const { result } = await load();

      await expect(
        result.current.saveOrThrow('applications/b/app', metadata),
      ).resolves.toBeUndefined();
      expect(updateApplicationAccess).not.toHaveBeenCalled();
    });

    it('resets the baseline once when the panel step succeeds', async () => {
      const { result } = await load();
      act(() => result.current.access.setEntries([]));

      await act(async () => {
        await result.current.saveOrThrow('applications/b/app', metadata);
      });

      expect(result.current.access.isDirty).toBe(false);
    });

    it('shows the generic message for another failure and keeps the draft', async () => {
      const { result } = await load();
      act(() => result.current.access.setEntries([]));
      vi.mocked(updateApplicationAccess).mockRejectedValue(
        new ResponseError(new Response('{}', { status: 500 })),
      );

      let isDone = true;
      await act(async () => {
        isDone = await result.current.save('applications/b/app', metadata);
      });

      expect(isDone).toBe(false);
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'generic failure' }),
      );
      expect(result.current.access.isDirty).toBe(true);
    });
  });
});
