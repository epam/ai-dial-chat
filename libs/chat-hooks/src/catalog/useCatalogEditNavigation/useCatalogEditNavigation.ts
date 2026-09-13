import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import { parseSkillResourceUrl } from '../../skill/skill-types';
import { findDeploymentByIdOrReference } from '../deployment-id';

/** A host notification `useCatalogEditNavigation` asks to be shown for a failed delete. */
export interface CatalogEditNavigationNotification {
  message: string;
  requestId?: string;
}

/** Localized copy `useCatalogEditNavigation` needs for the Create menu and delete errors. */
export interface CatalogEditNavigationLabels {
  createQuickApp: string;
  createToolset: string;
  createCustomApp: string;
  createSkill: string;
  createSkillWriteInstructions: string;
  createSkillUpload: string;
  createPrompt: string;
  deleteError: string;
}

/**
 * Injected editor-route URL builders, already closed over the host's own
 * route paths and query-parameter scheme. The lib knows nothing about either
 * — it only asks for "the URL to edit/create this kind of item".
 */
export interface CatalogEditNavigationUrls {
  /** URL to edit an existing prompt. */
  buildPromptEditUrl(promptId: string): string;
  /** URL to create a new prompt. */
  buildPromptCreateUrl(): string;
  /** URL to edit an existing skill. */
  buildSkillEditUrl(skillId: string): string;
  /** URL to create a new skill. */
  buildSkillCreateUrl(): string;
  /** URL to edit an existing toolset. */
  buildToolsetEditUrl(toolsetId: string): string;
  /** URL to create a new toolset. */
  buildToolsetCreateUrl(): string;
  /** URL to edit an existing custom (schema-less) app. */
  buildCustomAppEditUrl(appId: string): string;
  /** URL to create a new custom (schema-less) app. */
  buildCustomAppCreateUrl(): string;
  /** URL to edit an existing quick app under the given schema. */
  buildQuickAppEditUrl(schemaId: string, appId: string): string;
  /** URL to create a new quick app under the given schema. */
  buildQuickAppCreateUrl(schemaId: string): string;
}

/** Parameters accepted by {@link useCatalogEditNavigation}. */
export interface UseCatalogEditNavigationParams {
  deployments: DeploymentItemDto[];
  isCustomAppsEnabled: boolean;
  isSchemaAppsEnabled: boolean;
  isHideCustomAppCreationEnabled: boolean;
  isToolsetsEnabled: boolean;
  isPromptsEnabled: boolean;
  /** The quick-app schema id resolved by `useCatalogItems`, or `undefined` when no quick-app schema exists. */
  quickAppSchemaId: string | undefined;
  /** Already-configured editor-route URL builders. */
  urls: CatalogEditNavigationUrls;
  /** Navigates the host to a URL built by `urls`. */
  onNavigate: (url: string) => void;
  /** Already-configured DIAL Core operation: deletes a personal or shared prompt. */
  deletePrompt: (id: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a toolset. */
  deleteToolset: (id: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a skill package. */
  deleteSkill: (bucket: string, path: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a deployment/application. */
  deleteApplication: (id: string) => Promise<unknown>;
  refetchPrompts: () => Promise<void>;
  refetchToolsets: () => Promise<void>;
  refetchSkills: () => Promise<void>;
  refetchDeployments: () => Promise<void>;
  /** Called after a successful delete, so the host can notify with its own entity/operation vocabulary. */
  onDeleteSuccess: (item: CatalogItem) => void;
  /** Localized notification copy, resolved by the host. */
  labels: CatalogEditNavigationLabels;
  /** Called to surface a host notification when a delete fails. */
  onNotify: (notification: CatalogEditNavigationNotification) => void;
  /** Called when the Create menu's Skill → Upload option is picked. */
  onSkillUploadClick: () => void;
}

/** Return value of {@link useCatalogEditNavigation}. */
export interface UseCatalogEditNavigationResult {
  handleEdit: (item: CatalogItem) => void;
  handleDelete: (item: CatalogItem) => Promise<void>;
  createOptions: DropdownItem[];
}

/**
 * Owns the catalog's edit/delete/create-menu navigation: routing the details
 * panel's Edit action to the right editor URL for each item type, deleting an
 * item through the endpoint its type owns and refetching/notifying on
 * completion, and building the Create dropdown's options.
 */
export const useCatalogEditNavigation = ({
  deployments,
  isCustomAppsEnabled,
  isSchemaAppsEnabled,
  isHideCustomAppCreationEnabled,
  isToolsetsEnabled,
  isPromptsEnabled,
  quickAppSchemaId,
  urls,
  onNavigate,
  deletePrompt,
  deleteToolset,
  deleteSkill,
  deleteApplication,
  refetchPrompts,
  refetchToolsets,
  refetchSkills,
  refetchDeployments,
  onDeleteSuccess,
  labels,
  onNotify,
  onSkillUploadClick,
}: UseCatalogEditNavigationParams): UseCatalogEditNavigationResult => {
  const handleEdit = useCallback(
    (item: CatalogItem) => {
      if (item.type === CatalogEntityType.Prompt) {
        onNavigate(urls.buildPromptEditUrl(item.id));
        return;
      }

      if (item.type === CatalogEntityType.Skill) {
        onNavigate(urls.buildSkillEditUrl(item.id));
        return;
      }

      if (item.type === CatalogEntityType.Toolset) {
        onNavigate(urls.buildToolsetEditUrl(item.id));
        return;
      }

      const deployment = findDeploymentByIdOrReference(deployments, item.id);
      if (
        isCustomAppsEnabled &&
        deployment != null &&
        !deployment.applicationTypeSchemaId
      ) {
        onNavigate(urls.buildCustomAppEditUrl(item.id));
        return;
      }

      if (!quickAppSchemaId) return;
      onNavigate(urls.buildQuickAppEditUrl(quickAppSchemaId, item.id));
    },
    [deployments, isCustomAppsEnabled, quickAppSchemaId, onNavigate, urls],
  );

  const handleDelete = useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.type === CatalogEntityType.Prompt) {
          await deletePrompt(item.id);
          await refetchPrompts();
        } else if (item.type === CatalogEntityType.Toolset) {
          await deleteToolset(item.id);
          await refetchToolsets();
        } else if (item.type === CatalogEntityType.Skill) {
          const parsed = parseSkillResourceUrl(item.id);
          if (parsed == null) {
            throw new Error(`Invalid skill resource url: ${item.id}`);
          }
          await deleteSkill(parsed.bucket, parsed.path);
          await refetchSkills();
        } else {
          await deleteApplication(item.id);
          await refetchDeployments();
        }

        onDeleteSuccess(item);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        onNotify({
          message: labels.deleteError,
          requestId: traceId,
        });
        throw err;
      }
    },
    [
      deletePrompt,
      deleteToolset,
      deleteSkill,
      deleteApplication,
      refetchToolsets,
      refetchDeployments,
      refetchPrompts,
      refetchSkills,
      onDeleteSuccess,
      labels,
      onNotify,
    ],
  );

  const createOptions = useMemo<DropdownItem[]>(() => {
    const options: DropdownItem[] = [];

    if (
      quickAppSchemaId &&
      isSchemaAppsEnabled &&
      !isHideCustomAppCreationEnabled
    ) {
      options.push({
        key: 'quick-app',
        label: labels.createQuickApp,
        onClick: () =>
          onNavigate(urls.buildQuickAppCreateUrl(quickAppSchemaId)),
      });
    }

    if (isToolsetsEnabled) {
      options.push({
        key: 'toolset',
        label: labels.createToolset,
        onClick: () => onNavigate(urls.buildToolsetCreateUrl()),
      });
    }

    if (isCustomAppsEnabled && !isHideCustomAppCreationEnabled) {
      options.push({
        key: 'custom-app',
        label: labels.createCustomApp,
        onClick: () => onNavigate(urls.buildCustomAppCreateUrl()),
      });
    }

    options.push({
      key: 'skill',
      label: labels.createSkill,
      children: [
        {
          key: 'skill-write-instructions',
          label: labels.createSkillWriteInstructions,
          onClick: () => onNavigate(urls.buildSkillCreateUrl()),
        },
        {
          key: 'skill-upload',
          label: labels.createSkillUpload,
          onClick: onSkillUploadClick,
        },
      ],
    });

    if (isPromptsEnabled) {
      options.push({
        key: 'prompt',
        label: labels.createPrompt,
        onClick: () => onNavigate(urls.buildPromptCreateUrl()),
      });
    }

    return options;
  }, [
    quickAppSchemaId,
    onNavigate,
    urls,
    isPromptsEnabled,
    labels,
    isSchemaAppsEnabled,
    isHideCustomAppCreationEnabled,
    isToolsetsEnabled,
    isCustomAppsEnabled,
    onSkillUploadClick,
  ]);

  return {
    handleEdit,
    handleDelete,
    createOptions,
  };
};
