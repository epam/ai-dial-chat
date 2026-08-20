import type { SkillImportResponseDto } from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook } from '@testing-library/react';
import { ChangeEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EntityNotificationsI18nKeys,
  SkillArchiveImportI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { useSkills } from '../../../context/SkillsContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as skillsApi from '../../../server-api/skills.api';
import {
  mapSkillArchiveImportErrorKey,
  SkillArchiveImportStatus,
  useSkillArchiveImport,
} from '../useSkillArchiveImport';

vi.mock('../../../server-api/skills.api');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/SkillsContext');

const mockShowNotification = vi.fn();
const mockRefetchSkills = vi.fn().mockResolvedValue(undefined);
const mockImportSkillArchive = vi.mocked(skillsApi.importSkillArchive);

const IMPORT_RESPONSE: SkillImportResponseDto = {
  name: 'docs-helper',
  path: 'docs-helper',
  url: 'skills/my-bucket/docs-helper',
  etag: '"abc123"',
};

const makeChangeEvent = (
  file: File | undefined,
): ChangeEvent<HTMLInputElement> => {
  const target = {
    files: file ? [file] : [],
    value: 'C:\\fakepath\\skill.zip',
  } as unknown as HTMLInputElement;
  return { target } as unknown as ChangeEvent<HTMLInputElement>;
};

describe('useSkillArchiveImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    vi.mocked(useSkills).mockReturnValue({
      skills: [],
      publicSkills: [],
      sharedWithMe: [],
      isLoading: false,
      error: null,
      refetchSkills: mockRefetchSkills,
      mergeSharedSkill: vi.fn(),
    });
  });

  it('starts idle with no status message', () => {
    const { result } = renderHook(() => useSkillArchiveImport());

    expect(result.current.status).toBe(SkillArchiveImportStatus.Idle);
    expect(result.current.statusMessage).toBeUndefined();
  });

  it('uploads the selected file, notifies success, and refetches skills', async () => {
    mockImportSkillArchive.mockResolvedValue(IMPORT_RESPONSE);
    const { result } = renderHook(() => useSkillArchiveImport());
    const file = new File(['zip bytes'], 'skill.zip');
    const event = makeChangeEvent(file);

    await act(async () => {
      result.current.handleFileChange(event);
      await Promise.resolve();
    });

    expect(mockImportSkillArchive).toHaveBeenCalledWith(file);
    expect(mockRefetchSkills).toHaveBeenCalledOnce();
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Success,
      title: EntityNotificationsI18nKeys.SkillCreatedTitle,
      message: EntityNotificationsI18nKeys.SkillCreated,
    });
    expect(result.current.status).toBe(SkillArchiveImportStatus.Success);
  });

  it('resets the input value before invoking the import so re-selecting the same file re-triggers it', async () => {
    mockImportSkillArchive.mockResolvedValue(IMPORT_RESPONSE);
    const { result } = renderHook(() => useSkillArchiveImport());
    const file = new File(['zip bytes'], 'skill.zip');
    const event = makeChangeEvent(file);

    await act(async () => {
      result.current.handleFileChange(event);
      await Promise.resolve();
    });

    expect(event.target.value).toBe('');
  });

  it('ends in the error state, shows an error toast, and skips the success notification/refetch on failure', async () => {
    /* Mirrors the shape of a generated-client `ResponseError`, which
     * `getApiErrorStatus` reads via `error.response.status`. */
    mockImportSkillArchive.mockRejectedValue({
      response: new Response(null, { status: 409 }),
    });
    const { result } = renderHook(() => useSkillArchiveImport());
    const file = new File(['zip bytes'], 'skill.zip');
    const event = makeChangeEvent(file);

    await act(async () => {
      result.current.handleFileChange(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe(SkillArchiveImportStatus.Error);
    expect(result.current.statusMessage).toBe(
      SkillArchiveImportI18nKeys.ErrorCollision,
    );
    expect(mockRefetchSkills).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      title: SkillArchiveImportI18nKeys.ErrorTitle,
      message: SkillArchiveImportI18nKeys.ErrorCollision,
      requestId: undefined,
    });
  });

  it('includes a trace id on the error toast only for an unmapped/generic failure', async () => {
    mockImportSkillArchive.mockRejectedValue({
      response: {
        status: 401,
        /* No valid traceparent in the JSON body, so getApiErrorDetails falls back to the header. */
        json: () => Promise.resolve({}),
        headers: {
          get: (name: string) =>
            name === 'traceparent'
              ? '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
              : null,
        },
      },
    });
    const { result } = renderHook(() => useSkillArchiveImport());
    const file = new File(['zip bytes'], 'skill.zip');
    const event = makeChangeEvent(file);

    await act(async () => {
      result.current.handleFileChange(event);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusMessage).toBe(
      SkillArchiveImportI18nKeys.ErrorGeneric,
    );
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      title: SkillArchiveImportI18nKeys.ErrorTitle,
      message: SkillArchiveImportI18nKeys.ErrorGeneric,
      requestId: '0af7651916cd43dd8448eb211c80319c',
    });
  });

  it('does not start a second import while one is already in flight', () => {
    const { result } = renderHook(() => useSkillArchiveImport());
    const clickSpy = vi.fn();
    Object.defineProperty(result.current.fileInputRef, 'current', {
      value: { click: clickSpy },
      writable: true,
    });

    act(() => {
      const file = new File(['zip bytes'], 'skill.zip');
      mockImportSkillArchive.mockImplementation(
        () => new Promise(() => undefined),
      );
      result.current.handleFileChange(makeChangeEvent(file));
    });

    act(() => {
      result.current.triggerFilePicker();
    });

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('does nothing when no file is selected', () => {
    const { result } = renderHook(() => useSkillArchiveImport());

    act(() => {
      result.current.handleFileChange(makeChangeEvent(undefined));
    });

    expect(mockImportSkillArchive).not.toHaveBeenCalled();
    expect(result.current.status).toBe(SkillArchiveImportStatus.Idle);
  });
});

describe('mapSkillArchiveImportErrorKey', () => {
  it.each([
    [400, SkillArchiveImportI18nKeys.ErrorValidation],
    [413, SkillArchiveImportI18nKeys.ErrorValidation],
    [422, SkillArchiveImportI18nKeys.ErrorValidation],
    [409, SkillArchiveImportI18nKeys.ErrorCollision],
    [429, SkillArchiveImportI18nKeys.ErrorRateLimited],
    [502, SkillArchiveImportI18nKeys.ErrorServiceUnavailable],
    [503, SkillArchiveImportI18nKeys.ErrorServiceUnavailable],
    [401, SkillArchiveImportI18nKeys.ErrorGeneric],
    [undefined, SkillArchiveImportI18nKeys.ErrorGeneric],
  ])('maps status %s to %s', (status, expected) => {
    expect(mapSkillArchiveImportErrorKey(status)).toBe(expected);
  });
});
