import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
} from '@epam/ai-dial-catalog';
import type {
  SkillFileListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useRef } from 'react';
import { SKILL_MANIFEST_FILE } from '../skill/skill';
import type { SkillFileContent } from '../skill/skill-file-preview';
import { parseSkillManifestDocument } from '../skill/skill-manifest';
import { parseSkillResourceUrl } from '../skill/skill-types';
import type { ParsedSkillResourceUrl } from '../skill/skill-types';
import {
  buildSkillContentTree,
  buildSkillOverview,
  readSkillFileBytes,
  readSkillManifest,
  resolveSkillFileDownloadPath,
  resolveSkillManifestFileId,
} from './map-skill-to-catalog-item';
import type { SkillOverviewLabels } from './map-skill-to-catalog-item';

/** Injected API port for skill detail fetching. Mirrors exact server-api wrapper signatures. */
export interface SkillDetailsApi {
  /** Downloads a raw skill file, returning the raw fetch `Response`. */
  downloadSkillFile(
    bucket: string,
    path: string,
    filePath: string,
    signal?: AbortSignal,
  ): Promise<Response>;
  /** Lists files inside a skill package. */
  listSkillFiles(
    params: {
      bucket: string;
      filePath: string;
      path?: string;
      token?: string;
      limit?: number;
      recursive?: boolean;
    },
    signal?: AbortSignal,
  ): Promise<SkillFileListResponseDto>;
}

/**
 * Fetches a skill's manifest description for its listing tooltip. Returns
 * `null` when the skill id is unparseable, the manifest is unreadable, or the
 * request fails — callers treat all three as "no description", silently.
 * Dropped once DIAL Core's skill listing carries `description` (planned
 * upstream change), which also removes the per-skill download it performs.
 */
export const fetchSkillDescription = async (
  api: Pick<SkillDetailsApi, 'downloadSkillFile'>,
  skillId: string,
): Promise<string | null> => {
  const parsed = parseSkillResourceUrl(skillId);
  if (parsed == null) return null;

  try {
    const response = await api.downloadSkillFile(
      parsed.bucket,
      parsed.path,
      SKILL_MANIFEST_FILE,
    );
    if (!response.ok) return null;

    const manifest = await readSkillManifest(response);
    if (manifest == null) return null;

    return parseSkillManifestDocument(manifest).description ?? null;
  } catch {
    return null;
  }
};

/** Options accepted by `useSkillItemDetails`. */
export interface UseSkillItemDetailsOptions {
  /** Configured API adapter used for all network calls. */
  api: SkillDetailsApi;
  /**
   * Combined array of all skills visible to this user
   * (personal + shared + public) for overview metadata lookup.
   */
  skills: SkillMetadataItemDto[];
  /** Labels for skill overview section headers. */
  skillOverviewLabels: SkillOverviewLabels;
}

/** Returned callbacks from `useSkillItemDetails`. All callbacks are stable for stable inputs. */
export interface UseSkillItemDetailsResult {
  /**
   * Fetches full detail data for a skill catalog item.
   * Returns `undefined` on failure (error handled by caller).
   */
  onFetchSkillDetails(
    item: CatalogItem,
  ): Promise<CatalogItemDetailsFetchResult | undefined>;
  /**
   * Loads the text content of a file inside the currently open skill's package.
   * Returns `undefined` when the file cannot be read or is a directory.
   */
  onLoadContentFile(fileId: string): Promise<string | undefined>;
  /**
   * Downloads and returns preview bytes for a file inside the currently open skill's package.
   * Throws on HTTP errors, unparseable ids, and size-limit violations.
   */
  onLoadSkillDetailsFile(fileId: string): Promise<SkillFileContent>;
}

/**
 * Headless hook that encapsulates skill detail fetching: manifest download and
 * parse, package file listing, overview construction, and in-package file
 * loads. `useCatalogItemDetails` delegates its skill branch here; hosts that
 * only surface skill details consume this hook directly, without the
 * deployment and prompt ports the full catalog pipeline requires.
 */
export const useSkillItemDetails = ({
  api,
  skills,
  skillOverviewLabels,
}: UseSkillItemDetailsOptions): UseSkillItemDetailsResult => {
  /* Tracks the last skill whose details panel was opened, for file downloads. */
  const openSkillRef = useRef<ParsedSkillResourceUrl | null>(null);

  const onFetchSkillDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      const parsed = parseSkillResourceUrl(item.id);
      if (parsed == null) return undefined;

      const { bucket, path } = parsed;
      openSkillRef.current = parsed;

      const [manifest, files] = await Promise.allSettled([
        api
          .downloadSkillFile(bucket, path, SKILL_MANIFEST_FILE)
          .then(readSkillManifest),
        api.listSkillFiles({ bucket, path, filePath: '', recursive: true }),
      ]);

      const parsedManifest =
        manifest.status === 'fulfilled' && manifest.value != null
          ? parseSkillManifestDocument(manifest.value)
          : undefined;

      const skill = skills.find((candidate) => candidate.url === item.id);

      const overview =
        files.status === 'fulfilled'
          ? buildSkillOverview(
              skill,
              files.value.items,
              parsedManifest?.about,
              skillOverviewLabels,
            )
          : undefined;

      const contentFiles =
        files.status === 'fulfilled'
          ? buildSkillContentTree(files.value.items, path)
          : [];

      const selectedFileId =
        files.status === 'fulfilled'
          ? resolveSkillManifestFileId(files.value.items, path)
          : SKILL_MANIFEST_FILE;

      if (parsedManifest == null && overview == null) return undefined;

      return {
        ...(parsedManifest != null
          ? {
              promptContent: {
                content: parsedManifest.body,
                ...(parsedManifest.description != null
                  ? { description: parsedManifest.description }
                  : {}),
                files: contentFiles,
                selectedFileId,
              },
            }
          : {}),
        ...(overview != null ? { overview } : {}),
      };
    },
    [api, skills, skillOverviewLabels],
  );

  const onLoadContentFile = useCallback(
    async (fileId: string): Promise<string | undefined> => {
      const openSkill = openSkillRef.current;
      if (openSkill == null) return undefined;

      const filePath = resolveSkillFileDownloadPath(fileId, openSkill.path);
      if (filePath == null) return undefined;

      const response = await api.downloadSkillFile(
        openSkill.bucket,
        openSkill.path,
        filePath,
      );
      const text = await readSkillManifest(response);
      if (text == null) return undefined;

      return filePath === SKILL_MANIFEST_FILE
        ? parseSkillManifestDocument(text).body
        : text;
    },
    [api],
  );

  const onLoadSkillDetailsFile = useCallback(
    async (fileId: string): Promise<SkillFileContent> => {
      const openSkill = openSkillRef.current;
      if (openSkill == null) throw new Error('No skill details are open');

      const filePath = resolveSkillFileDownloadPath(fileId, openSkill.path);
      if (filePath == null) throw new Error('A folder cannot be previewed');

      const response = await api.downloadSkillFile(
        openSkill.bucket,
        openSkill.path,
        filePath,
      );

      if (!response.ok) {
        throw Object.assign(
          new Error(`File preview failed with status ${response.status}`),
          { status: response.status },
        );
      }

      const bytes = await readSkillFileBytes(response);
      if (bytes == null) throw new Error('File exceeds the preview size limit');

      const responseMimeType =
        response.headers.get('content-type')?.split(';')[0].trim() || undefined;

      return {
        bytes,
        /* Core commonly sends this generic value; omitting it lets the same extension inference as Skill Builder run. */
        mimeType:
          responseMimeType === 'application/octet-stream'
            ? undefined
            : responseMimeType,
      };
    },
    [api],
  );

  return { onFetchSkillDetails, onLoadContentFile, onLoadSkillDetailsFile };
};
