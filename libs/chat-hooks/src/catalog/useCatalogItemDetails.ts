import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentDetailsDto,
  DeploymentLimitsResponseDto,
  PromptResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { parsePromptResourceUrl } from '../prompt/prompt-resource';
import type { SkillFileContent } from '../skill/skill-file-preview';
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
import type { SkillOverviewLabels } from './map-skill-to-catalog-item';
import { buildConnectApi, resolveMcpResourceKind } from './mcp-endpoint-url';
import { useSkillItemDetails, type SkillDetailsApi } from './useSkillItemDetails';

/** Injected API port for catalog item detail fetching. Mirrors exact server-api wrapper signatures. */
export interface CatalogDetailsApi extends SkillDetailsApi {
  /** Fetches deployment-level details for a model, agent, toolset, or application. */
  getDeploymentDetails(deploymentId: string): Promise<DeploymentDetailsDto>;
  /** Fetches rate-limit data for a deployment. */
  getDeploymentLimits(
    deploymentId: string,
  ): Promise<DeploymentLimitsResponseDto>;
  /** Fetches a personal or shared prompt by its full `prompts/{bucket}/{path}` resource id. */
  getPrompt(id: string): Promise<PromptResponseDto>;
  /** Fetches a public (organisation) prompt by its bucket-relative path. */
  getPublicPrompt(path: string): Promise<PromptResponseDto>;
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
 * `item.id` is always the full `prompts/{bucket}/{path}` resource path, and
 * the personal/shared read endpoint takes it unmodified. The organisation
 * (public) endpoint kept its bucket-relative `path` argument, so its
 * qualified id is parsed back down to that sub-path first.
 */
const buildFetchPromptDto =
  (api: CatalogDetailsApi) =>
  (item: CatalogItem): Promise<PromptResponseDto> => {
    if (!isOrganisationPromptItem(item)) return api.getPrompt(item.id);
    const parsed = parsePromptResourceUrl(item.id);
    return api.getPublicPrompt(parsed?.path ?? item.id);
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
  /*
   * The skill pipeline (manifest, file listing, in-package file loads) lives
   * in the skill-scoped hook; only the dispatch on entity type stays here.
   */
  const { onFetchSkillDetails, onLoadContentFile, onLoadSkillDetailsFile } =
    useSkillItemDetails({ api, skills, skillOverviewLabels });

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
        return onFetchSkillDetails(item);
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
      promptOverviewLabels,
      onFetchSkillDetails,
    ],
  );

  return { onFetchDetails, onLoadContentFile, onLoadSkillDetailsFile };
};
