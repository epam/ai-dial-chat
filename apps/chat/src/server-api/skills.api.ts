import type {
  SkillFileDeleteResponseDto,
  SkillFileListResponseDto,
  SkillFileUploadResponseDto,
  SkillGroupingFolderResponseDto,
  SkillListResponseDto,
  SkillOperationResultDto,
  SkillUploadResponseDto,
} from '@epam/chat-api-client';
import { skillsApi } from './api-client';

export const listSkills = (
  params: {
    bucket: string;
    path?: string;
    token?: string;
    limit?: number;
    recursive?: boolean;
  },
  signal?: AbortSignal,
): Promise<SkillListResponseDto> =>
  skillsApi.listSkills(params, signal ? { signal } : undefined);

export const listSkillFiles = (
  params: {
    bucket: string;
    filePath: string;
    path?: string;
    token?: string;
    limit?: number;
    recursive?: boolean;
  },
  signal?: AbortSignal,
): Promise<SkillFileListResponseDto> =>
  skillsApi.listSkillFiles(params, signal ? { signal } : undefined);

/*
 * downloadSkillRaw() is used instead of downloadSkill() for the same reason as
 * files.api.ts's downloadFileRaw() — the generator emits `Blob | void` for the
 * application/zip response, which loses stream semantics. The raw method
 * returns the native fetch Response whose `.body` is a ReadableStream.
 */
export const downloadSkill = async (
  bucket: string,
  path: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const raw = await skillsApi.downloadSkillRaw(
    { bucket, path },
    ...(signal ? [{ signal }] : []),
  );
  return raw.raw;
};

/*
 * downloadSkillFileRaw() is used instead of downloadSkillFile() for the same
 * reason as downloadSkillRaw() above.
 */
export const downloadSkillFile = async (
  bucket: string,
  path: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const raw = await skillsApi.downloadSkillFileRaw(
    { bucket, path, filePath },
    ...(signal ? [{ signal }] : []),
  );
  return raw.raw;
};

/*
 * The new aggregate ETag comes back in the JSON response body
 * (SkillUploadResponseDto.etag), not as an HTTP response header on the BFF's
 * own response, so the plain (non-Raw) generated method is sufficient here —
 * unlike the binary download methods above, there's no stream/header
 * semantics to preserve.
 */
export const uploadSkill = (
  bucket: string,
  path: string,
  file: Blob,
  ifMatch?: string,
  signal?: AbortSignal,
): Promise<SkillUploadResponseDto> =>
  skillsApi.uploadSkill(
    { bucket, path, file, ifMatch },
    signal ? { signal } : undefined,
  );

export const uploadSkillFile = (
  bucket: string,
  path: string,
  filePath: string,
  file: Blob,
  ifMatch?: string,
  signal?: AbortSignal,
): Promise<SkillFileUploadResponseDto> =>
  skillsApi.uploadSkillFile(
    { bucket, path, filePath, file, ifMatch },
    signal ? { signal } : undefined,
  );

export const deleteSkill = (
  bucket: string,
  path: string,
  ifMatch?: string,
  signal?: AbortSignal,
): Promise<SkillOperationResultDto> =>
  skillsApi.deleteSkill(
    { bucket, path, ifMatch },
    signal ? { signal } : undefined,
  );

export const deleteSkillFile = (
  bucket: string,
  path: string,
  filePath: string,
  ifMatch?: string,
  signal?: AbortSignal,
): Promise<SkillFileDeleteResponseDto> =>
  skillsApi.deleteSkillFile(
    { bucket, path, filePath, ifMatch },
    signal ? { signal } : undefined,
  );

export const createSkillGroupingFolder = (
  bucket: string,
  path: string,
  signal?: AbortSignal,
): Promise<SkillGroupingFolderResponseDto> =>
  skillsApi.createSkillGroupingFolder(
    { bucket, path },
    signal ? { signal } : undefined,
  );

export const deleteSkillGroupingFolder = (
  bucket: string,
  path: string,
  ifMatch?: string,
  signal?: AbortSignal,
): Promise<SkillOperationResultDto> =>
  skillsApi.deleteSkillGroupingFolder(
    { bucket, path, ifMatch },
    signal ? { signal } : undefined,
  );
