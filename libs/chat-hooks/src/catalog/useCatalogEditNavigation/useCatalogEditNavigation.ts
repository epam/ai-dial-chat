import type { CatalogCreateSearch, CatalogItem } from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useState } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import {
  getRunnerSchemas,
  isQuickAppSchema,
} from '../../shared/application-schema';
import { parseSkillResourceUrl } from '../../skill/skill-types';
import { findDeploymentByIdOrReference } from '../deployment-id';

/** A host notification `useCatalogEditNavigation` asks to be shown for a failed delete. */
export interface CatalogEditNavigationNotification {
  message: string;
  requestId?: string;
}

/** Localized copy `useCatalogEditNavigation` needs for the Create menu and delete errors. */
export interface CatalogEditNavigationLabels {
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
  /** URL to edit an existing schema-based app (quick app or any other runner) under the given schema. */
  buildQuickAppEditUrl(schemaId: string, appId: string): string;
  /** URL to create a new schema-based app (quick app or any other runner) under the given schema. */
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
  /** Application type schemas (runners) loaded at startup; each one except the custom-app schema gets its own Create option. */
  schemas: ApplicationSchemaSummaryDto[];
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
  /** The Create dropdown's items: runners and static options sorted together by label, all filtered by `createSearch.value`. */
  createOptions: DropdownItem[];
  /** The Create menu's search field state, or `undefined` when no runner option is offered. */
  createSearch: CatalogCreateSearch | undefined;
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
  schemas,
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
  const runnerSchemas = useMemo(() => getRunnerSchemas(schemas), [schemas]);
  const [createSearchQuery, setCreateSearchQuery] = useState('');
  const isRunnerCreationEnabled =
    isSchemaAppsEnabled && !isHideCustomAppCreationEnabled;

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

      const schemaId =
        runnerSchemas.find(
          (schema) => schema.id === deployment?.applicationTypeSchemaId,
        )?.id ?? runnerSchemas.find((schema) => isQuickAppSchema(schema))?.id;
      if (!schemaId) return;
      onNavigate(urls.buildQuickAppEditUrl(schemaId, item.id));
    },
    [deployments, isCustomAppsEnabled, runnerSchemas, onNavigate, urls],
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
    const query = createSearchQuery.trim().toLocaleLowerCase();
    const isMatch = (label: string) =>
      !query || label.toLocaleLowerCase().includes(query);
    const options: DropdownItem[] = [];

    if (isRunnerCreationEnabled) {
      runnerSchemas
        .map((schema) => ({
          id: schema.id,
          label: schema.displayName || schema.id,
        }))
        .filter((runner) => isMatch(runner.label))
        .forEach((runner) => {
          options.push({
            key: `runner:${runner.id}`,
            label: runner.label,
            onClick: () => onNavigate(urls.buildQuickAppCreateUrl(runner.id)),
          });
        });
    }

    if (isToolsetsEnabled && isMatch(labels.createToolset)) {
      options.push({
        key: 'toolset',
        label: labels.createToolset,
        onClick: () => onNavigate(urls.buildToolsetCreateUrl()),
      });
    }

    if (
      isCustomAppsEnabled &&
      !isHideCustomAppCreationEnabled &&
      isMatch(labels.createCustomApp)
    ) {
      options.push({
        key: 'custom-app',
        label: labels.createCustomApp,
        onClick: () => onNavigate(urls.buildCustomAppCreateUrl()),
      });
    }

    const skillChildren: DropdownItem[] = [
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
    ];
    // A query naming the Skill group keeps both children; otherwise only the matching ones.
    const visibleSkillChildren = isMatch(labels.createSkill)
      ? skillChildren
      : skillChildren.filter((child) => isMatch(String(child.label)));
    if (visibleSkillChildren.length > 0) {
      options.push({
        key: 'skill',
        label: labels.createSkill,
        children: visibleSkillChildren,
      });
    }

    if (isPromptsEnabled && isMatch(labels.createPrompt)) {
      options.push({
        key: 'prompt',
        label: labels.createPrompt,
        onClick: () => onNavigate(urls.buildPromptCreateUrl()),
      });
    }

    // Every label this hook builds is a string, so runners and the static options sort together.
    return options.sort((a, b) =>
      String(a.label ?? '').localeCompare(String(b.label ?? ''), undefined, {
        sensitivity: 'base',
      }),
    );
  }, [
    createSearchQuery,
    isRunnerCreationEnabled,
    runnerSchemas,
    onNavigate,
    urls,
    isPromptsEnabled,
    labels,
    isHideCustomAppCreationEnabled,
    isToolsetsEnabled,
    isCustomAppsEnabled,
    onSkillUploadClick,
  ]);

  const createSearch = useMemo<CatalogCreateSearch | undefined>(
    () =>
      isRunnerCreationEnabled && runnerSchemas.length > 0
        ? { value: createSearchQuery, onChange: setCreateSearchQuery }
        : undefined,
    [isRunnerCreationEnabled, runnerSchemas.length, createSearchQuery],
  );

  return {
    handleEdit,
    handleDelete,
    createOptions,
    createSearch,
  };
};
