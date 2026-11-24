import {
  ApplicationErrorCode,
  ResourceDependencyAccess,
  ResponseError,
  type ApplicationResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { AccessLevel } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiError from '../../api-error/api-error';
import {
  ApplicationAccessContentType,
  ApplicationAccessLoadStatus,
  ApplicationAccessSaveOutcome,
} from '../types';
import { useApplicationAccessSync } from '../useApplicationAccessSync/useApplicationAccessSync';

const { Read } = ResourceDependencyAccess;

const FILES: ApplicationResourceDependencyDto = {
  linkId: 'f',
  target: { url: 'files/{current-user}/' },
  access: [Read],
};
const POLICIES: ApplicationResourceDependencyDto = {
  linkId: 'p',
  target: { url: 'files/public/policies/' },
  access: [Read],
  required: true,
};

const loadStoredList =
  vi.fn<(appId: string) => Promise<ApplicationResourceDependencyDto[]>>();
const saveList =
  vi.fn<
    (
      appId: string,
      list: ApplicationResourceDependencyDto[],
      context: string,
    ) => Promise<unknown>
  >();

interface Props {
  isEnabled?: boolean;
  appId?: string;
  shouldLoad?: boolean;
}

const renderSync = (initial: Props = {}) =>
  renderHook(
    (props: Props) =>
      useApplicationAccessSync<string>({
        isEnabled: true,
        appId: 'applications/b/app',
        shouldLoad: true,
        loadStoredList,
        saveList,
        ...props,
      }),
    { initialProps: initial },
  );

const responseError = (status: number, body: Record<string, unknown> = {}) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const refusal = () =>
  responseError(403, {
    statusCode: 403,
    code: ApplicationErrorCode.ApplicationResourceDependenciesNotAllowed,
  });

const loaded = async (props: Props = {}) => {
  const view = renderSync(props);
  await waitFor(() =>
    expect(view.result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
  );
  return view;
};

describe('useApplicationAccessSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loadStoredList.mockReset().mockResolvedValue([FILES, POLICIES]);
    saveList.mockReset().mockResolvedValue(undefined);
  });

  describe('loading', () => {
    it('is loading first, then holds the stored list as its clean baseline', async () => {
      const { result } = renderSync();
      expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loading);

      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );

      expect(loadStoredList).toHaveBeenCalledWith('applications/b/app');
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

    it('reports no stored entries for an application with an empty list', async () => {
      loadStoredList.mockResolvedValue([]);
      const { result } = await loaded();
      expect(result.current.hasStoredEntries).toBe(false);
    });

    it('reads the list once however often it re-renders', async () => {
      const { result, rerender } = renderSync();
      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );
      rerender({});
      expect(loadStoredList).toHaveBeenCalledOnce();
    });

    it('fails, then reads again on retry', async () => {
      loadStoredList.mockRejectedValueOnce(new Error('network'));
      const { result } = renderSync();
      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Failed),
      );

      act(() => result.current.retry());

      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );
      expect(loadStoredList).toHaveBeenCalledTimes(2);
    });

    it('reads the new application and drops the old answer when the id changes mid-load', async () => {
      const resolvers: Record<
        string,
        (list: ApplicationResourceDependencyDto[]) => void
      > = {};
      loadStoredList.mockImplementation(
        (id) =>
          new Promise((done) => {
            resolvers[id] = done;
          }),
      );
      const { result, rerender } = renderSync({ appId: 'applications/b/one' });

      rerender({ appId: 'applications/b/two' });
      await waitFor(() =>
        expect(resolvers['applications/b/two']).toBeDefined(),
      );
      resolvers['applications/b/one']([FILES]);
      resolvers['applications/b/two']([]);

      await waitFor(() =>
        expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded),
      );
      expect(result.current.access.entries).toEqual([]);
      expect(result.current.hasStoredEntries).toBe(false);
    });

    it.each([
      ['a disabled section', { isEnabled: false }],
      ['a new application', { appId: '' }],
      ['an application the editor created itself', { shouldLoad: false }],
    ])('reads nothing for %s and starts loaded', (_, props) => {
      const { result } = renderSync(props);
      expect(loadStoredList).not.toHaveBeenCalled();
      expect(result.current.status).toBe(ApplicationAccessLoadStatus.Loaded);
    });
  });

  describe('save', () => {
    it('sends nothing while the draft is untouched', async () => {
      const { result } = await loaded();

      await expect(
        result.current.save('applications/b/app', 'ctx'),
      ).resolves.toEqual({ outcome: ApplicationAccessSaveOutcome.Unchanged });
      expect(saveList).not.toHaveBeenCalled();
    });

    it('sends nothing for a disabled section even when the draft changed', async () => {
      const { result } = renderSync({ isEnabled: false, appId: '' });
      act(() =>
        result.current.access.setEntries([
          {
            contentType: ApplicationAccessContentType.Skills,
            accessLevel: AccessLevel.Read,
          },
        ]),
      );

      const { outcome } = await result.current.save(
        'applications/b/app',
        'ctx',
      );

      expect(outcome).toBe(ApplicationAccessSaveOutcome.Unchanged);
      expect(saveList).not.toHaveBeenCalled();
    });

    it('sends the full list with the context and resets the baseline', async () => {
      const { result } = await loaded();
      act(() => result.current.access.setEntries([]));

      let outcome: ApplicationAccessSaveOutcome | undefined;
      await act(async () => {
        ({ outcome } = await result.current.save('applications/b/app', 'ctx'));
      });

      expect(outcome).toBe(ApplicationAccessSaveOutcome.Saved);
      expect(saveList).toHaveBeenCalledWith(
        'applications/b/app',
        [POLICIES],
        'ctx',
      );
      expect(result.current.access.isDirty).toBe(false);
      expect(result.current.hasStoredEntries).toBe(true);
    });

    it('updates hasStoredEntries when the saved list is empty', async () => {
      loadStoredList.mockResolvedValue([FILES]);
      const { result } = await loaded();
      act(() => result.current.access.setEntries([]));

      await act(async () => {
        await result.current.save('applications/b/app', 'ctx');
      });

      expect(saveList.mock.calls[0][1]).toEqual([]);
      expect(result.current.hasStoredEntries).toBe(false);
    });

    it('sends against the id it is given', async () => {
      const { result } = renderSync({ appId: '', shouldLoad: false });
      act(() =>
        result.current.access.setEntries([
          {
            contentType: ApplicationAccessContentType.Prompts,
            accessLevel: AccessLevel.Read,
          },
        ]),
      );

      await act(async () => {
        await result.current.save('applications/b/created', 'ctx');
      });

      expect(saveList.mock.calls[0][0]).toBe('applications/b/created');
    });

    describe('when the save fails', () => {
      const edit = async () => {
        const view = await loaded();
        act(() => view.result.current.access.setEntries([]));
        return view;
      };

      it('reports a refusal with its trace id and keeps the draft and the baseline', async () => {
        const { result } = await edit();
        saveList.mockRejectedValue(refusal());

        const saved = await result.current.save('applications/b/app', 'ctx');

        expect(saved.outcome).toBe(ApplicationAccessSaveOutcome.Refused);
        expect(result.current.access.isDirty).toBe(true);
        await act(async () => {
          await result.current.save('applications/b/app', 'ctx');
        });
        expect(saveList).toHaveBeenCalledTimes(2);
      });

      it('reports any other failure with the API message', async () => {
        const { result } = await edit();
        saveList.mockRejectedValue(
          responseError(500, { statusCode: 500, message: 'Core is down' }),
        );

        const saved = await result.current.save('applications/b/app', 'ctx');

        expect(saved).toMatchObject({
          outcome: ApplicationAccessSaveOutcome.Failed,
          message: 'Core is down',
        });
        expect(result.current.access.isDirty).toBe(true);
      });

      it('reports a failure without a message when the body carries none', async () => {
        const { result } = await edit();
        saveList.mockRejectedValue(responseError(500));

        const saved = await result.current.save('applications/b/app', 'ctx');

        expect(saved.outcome).toBe(ApplicationAccessSaveOutcome.Failed);
        expect(saved.message ?? null).toBeNull();
      });

      it('reports a failure when the error body cannot be read', async () => {
        const { result } = await edit();
        saveList.mockRejectedValue(new Error('boom'));
        vi.spyOn(apiError, 'getApiErrorDetails').mockRejectedValueOnce(
          new Error('unreadable'),
        );

        const saved = await result.current.save('applications/b/app', 'ctx');

        expect(saved).toEqual({
          outcome: ApplicationAccessSaveOutcome.Failed,
          message: null,
          traceId: undefined,
        });
        expect(result.current.access.isDirty).toBe(true);
      });
    });
  });
});
