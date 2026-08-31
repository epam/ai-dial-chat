import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentDetailsDto,
  DeploymentLimitsResponseDto,
  PromptResponseDto,
  SkillFileListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { useCallback, useRef } from 'react';
import { parsePromptResourceUrl } from '../prompt/prompt-resource';
import { SKILL_MANIFEST_FILE } from '../skill/skill';
import type { SkillFileContent } from '../skill/skill-file-preview';
import { parseSkillManifestDocument } from '../skill/skill-manifest';
import { parseSkillResourceUrl } from '../skill/skill-types';
import type { ParsedSkillResourceUrl } from '../skill/skill-types';
import { buildDeploymentConnectApi } from './deployment-endpoint-url';
import type { DeploymentLimitsLabels } from './map-deployment-limits-to-catalog';
import { mapDeploymentLimitsDtoToCatalogLimits } from './map-deployment-limits-to-catalog';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
  mapToolsetCredentials,
} from './map-entity-details-to-catalog';
import {
  buildPromptOverview,
  isOrganisationPromptItem,
} from './map-prompt-to-catalog-item';
import type { PromptOverviewLabels } from './map-prompt-to-catalog-item';
import {
  buildSkillContentTree,
  buildSkillOverview,
  readSkillFileBytes,
  readSkillManifest,
  resolveSkillFileDownloadPath,
  resolveSkillManifestFileId,
} from './map-skill-to-catalog-item';
import type { SkillOverviewLabels } from './map-skill-to-catalog-item';
import { buildConnectApi, resolveMcpResourceKind } from './mcp-endpoint-url';

/** Injected API port for catalog item detail fetching. Mirrors exact server-api wrapper signatures. */
export interface CatalogDetailsApi {
  /** Fetches deployment-level details for a model, agent, toolset, or application. */
  getDeploymentDetails(deploymentId: string): Promise<DeploymentDetailsDto>;
  /** Fetches rate-limit data for a deployment. */
  getDeploymentLimits(
    deploymentId: string,
  ): Promise<DeploymentLimitsResponseDto>;
  /** Fetches a personal or bucket-scoped prompt by path. */
  getPrompt(path: string, bucket?: string): Promise<PromptResponseDto>;
  /** Fetches a public (organisation) prompt by path. */
  getPublicPrompt(path: string): Promise<PromptResponseDto>;
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

/** Options accepted by `useCatalogItemDetails`. */
export interface UseCatalogItemDetailsOptions {
  /** Configured API adapter used for all network calls. */
  api: CatalogDetailsApi;
  /**
   * Combined array of all skills visible to this user
   * (personal + shared + public) for overview metadata lookup.
   */
  skills: SkillMetadataItemDto[];
  /** Whether the current user has admin privileges (affects toolset credential visibility). */
  isAdmin: boolean;
  /** DIAL Core external base URL used for Connect-tab endpoint construction. */
  dialCoreExternalUrl: string | null | undefined;
  /** Labels for skill overview section headers. */
  skillOverviewLabels: SkillOverviewLabels;
  /** Labels for prompt overview section headers. */
  promptOverviewLabels: PromptOverviewLabels;
  /** Labels for deployment limits table. */
  deploymentLimitsLabels: DeploymentLimitsLabels;
}

/** Returned callbacks from `useCatalogItemDetails`. All callbacks are stable for stable inputs. */
export interface UseCatalogItemDetailsResult {
  /**
   * Fetches full detail data for a catalog item.
   * Returns `undefined` on failure (error handled by caller).
   */
  onFetchDetails(
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

/*
 * Dispatches to the prompt endpoints for all prompt source variants.
 * Organisation prompts must use the public endpoint so the correct bucket
 * is resolved; personal/shared prompts use the personal endpoint (with an
 * explicit bucket when the id is a full resource URL).
 */
const buildFetchPromptDto =
  (api: CatalogDetailsApi) =>
  (item: CatalogItem): Promise<PromptResponseDto> => {
    if (isOrganisationPromptItem(item)) return api.getPublicPrompt(item.id);
    const ref = parsePromptResourceUrl(item.id);
    if (ref == null) return api.getPrompt(item.id);
    return api.getPrompt(ref.path, ref.bucket);
  };

/**
 * Headless hook that encapsulates catalog item detail fetching.
 * Extracts the inline dispatch logic from `CatalogView` into a reusable,
 * library-isolated unit.
 */
export const useCatalogItemDetails = ({
  api,
  skills,
  isAdmin,
  dialCoreExternalUrl,
  skillOverviewLabels,
  promptOverviewLabels,
  deploymentLimitsLabels,
}: UseCatalogItemDetailsOptions): UseCatalogItemDetailsResult => {
  /* Tracks the last skill whose details panel was opened, for file downloads. */
  const openSkillRef = useRef<ParsedSkillResourceUrl | null>(null);

  const onFetchDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      if (item.type === CatalogEntityType.Prompt) {
        try {
          const fetchPromptDto = buildFetchPromptDto(api);
          const dto = await fetchPromptDto(item);
          return {
            promptContent: { content: dto.content },
            overview: buildPromptOverview(dto, promptOverviewLabels),
          };
        } catch {
          return undefined;
        }
      }

      if (item.type === CatalogEntityType.Skill) {
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
      }

      try {
        const limitsPromise =
          item.type === CatalogEntityType.Model
            ? api.getDeploymentLimits(item.id).catch(() => undefined)
            : Promise.resolve(undefined);

        const [dto, limitsDto] = await Promise.all([
          api.getDeploymentDetails(item.id),
          limitsPromise,
        ]);

        const entityDetails = mapDeploymentDetailsDtoToEntityDetails(dto);
        const catalogDetails = mapEntityDetailsToCatalogDetails(entityDetails);
        const mcpResourceKind = resolveMcpResourceKind(
          item.type,
          item.supportsMcp,
        );

        const deploymentConnectApi =
          entityDetails.type === 'MODEL' || entityDetails.type === 'AGENT'
            ? buildDeploymentConnectApi(dialCoreExternalUrl ?? '', item.id, {
                hasChatCompletion:
                  entityDetails.data.capabilities?.hasChatCompletion,
                hasResponsesApi:
                  entityDetails.data.capabilities?.hasResponsesApi,
              })
            : undefined;

        return {
          ...catalogDetails,
          api:
            mcpResourceKind != null
              ? buildConnectApi(
                  dialCoreExternalUrl ?? '',
                  item.id,
                  mcpResourceKind,
                )
              : (deploymentConnectApi ?? catalogDetails.api),
          limits: mapDeploymentLimitsDtoToCatalogLimits(
            limitsDto,
            deploymentLimitsLabels,
          ),
          credentials:
            entityDetails.type === 'TOOLSET'
              ? mapToolsetCredentials(item.id, entityDetails.data, isAdmin)
              : undefined,
        };
      } catch {
        return undefined;
      }
    },
    [
      api,
      isAdmin,
      deploymentLimitsLabels,
      dialCoreExternalUrl,
      skills,
      promptOverviewLabels,
      skillOverviewLabels,
    ],
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

  return { onFetchDetails, onLoadContentFile, onLoadSkillDetailsFile };
};
