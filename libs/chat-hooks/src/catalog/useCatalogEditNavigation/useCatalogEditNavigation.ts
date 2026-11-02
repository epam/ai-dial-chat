import type {
  CatalogCreateSearch,
  CatalogItem,
  CatalogTabCreateMenu,
} from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { DropdownItem, DropdownItemType } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useState } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import {
  getRunnerSchemas,
  isQuickAppSchema,
} from '../../shared/application-schema';
import { parseSkillResourceUrl } from '../../skill/skill-types';
import { findDeploymentByIdOrReference } from '../deployment-id';

/* The default creation predicate for hosts that apply no creation policy. */
const ALLOW_ANY_SCHEMA = (): boolean => true;

// Every label this hook builds is a string, so options within a section sort by it.
const sortByLabel = (options: DropdownItem[]): DropdownItem[] =>
  [...options].sort((a, b) =>
    String(a.label ?? '').localeCompare(String(b.label ?? ''), undefined, {
      sensitivity: 'base',
    }),
  );

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
  /** Header of the Create menu's runner section (Custom App and the runner schemas). */
  createRunners: string;
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
  /* The creation decisions below gate only the Create menu, on top of the
   * feature flags above; edit, delete and edit-schema routing ignore them. */
  /** Whether the host lets the user create a custom app. Defaults to `true`. */
  canCreateCustomApp?: boolean;
  /** Whether the host lets the user create a toolset. Defaults to `true`. */
  canCreateToolset?: boolean;
  /** Whether the host lets the user create a prompt. Defaults to `true`. */
  canCreatePrompt?: boolean;
  /** Whether the host lets the user create a skill, by either Skill child. Defaults to `true`. */
  canCreateSkill?: boolean;
  /** Whether a runner option is offered for this exact schema id. Defaults to allowing every schema. */
  canCreateSchema?: (schemaId: string) => boolean;
}

/** Return value of {@link useCatalogEditNavigation}. */
export interface UseCatalogEditNavigationResult {
  handleEdit: (item: CatalogItem) => void;
  handleDelete: (item: CatalogItem) => Promise<void>;
  /**
   * The Create dropdown's items, all filtered by `createSearch.value`: Toolset,
   * Skill and Prompt sorted by label, then a divider and a runner-section header,
   * then Custom App and the runners sorted by label. The divider and header are
   * present only while both sections hold an option.
   */
  createOptions: DropdownItem[];
  /** The Create menu's search field state, or `undefined` when no runner option is offered. */
  createSearch: CatalogCreateSearch | undefined;
  /** The Create menu narrowed to each entity type; models have no entry since they cannot be created. */
  createMenuByType: Partial<Record<CatalogEntityType, CatalogTabCreateMenu>>;
  /** Whether any Create option passes the feature flags and creation decisions, ignoring the search query. */
  hasCreateOptions: boolean;
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
  canCreateCustomApp = true,
  canCreateToolset = true,
  canCreatePrompt = true,
  canCreateSkill = true,
  canCreateSchema = ALLOW_ANY_SCHEMA,
}: UseCatalogEditNavigationParams): UseCatalogEditNavigationResult => {
  // Edit routing resolves against every runner schema, creatable or not.
  const runnerSchemas = useMemo(() => getRunnerSchemas(schemas), [schemas]);
  const [createSearchQuery, setCreateSearchQuery] = useState('');
  const isRunnerCreationEnabled =
    isSchemaAppsEnabled && !isHideCustomAppCreationEnabled;
  const creatableRunnerSchemas = useMemo(
    () =>
      isRunnerCreationEnabled
        ? runnerSchemas.filter((schema) => canCreateSchema(schema.id))
        : [],
    [isRunnerCreationEnabled, runnerSchemas, canCreateSchema],
  );
  const isToolsetCreatable = isToolsetsEnabled && canCreateToolset;
  const isCustomAppCreatable =
    isCustomAppsEnabled &&
    !isHideCustomAppCreationEnabled &&
    canCreateCustomApp;
  const isPromptCreatable = isPromptsEnabled && canCreatePrompt;
  const hasCreateOptions =
    creatableRunnerSchemas.length > 0 ||
    isToolsetCreatable ||
    isCustomAppCreatable ||
    canCreateSkill ||
    isPromptCreatable;

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

  const createMenuParts = useMemo(() => {
    const query = createSearchQuery.trim().toLocaleLowerCase();
    const isMatch = (label: string) =>
      !query || label.toLocaleLowerCase().includes(query);
    const runnerOptions: DropdownItem[] = creatableRunnerSchemas
      .map((schema) => ({
        id: schema.id,
        label: schema.displayName || schema.id,
      }))
      .filter((runner) => isMatch(runner.label))
      .map((runner) => ({
        key: `runner:${runner.id}`,
        label: runner.label,
        onClick: () => onNavigate(urls.buildQuickAppCreateUrl(runner.id)),
      }));

    const toolsetOption: DropdownItem | undefined =
      isToolsetCreatable && isMatch(labels.createToolset)
        ? {
            key: 'toolset',
            label: labels.createToolset,
            onClick: () => onNavigate(urls.buildToolsetCreateUrl()),
          }
        : undefined;

    const customAppOption: DropdownItem | undefined =
      isCustomAppCreatable && isMatch(labels.createCustomApp)
        ? {
            key: 'custom-app',
            label: labels.createCustomApp,
            onClick: () => onNavigate(urls.buildCustomAppCreateUrl()),
          }
        : undefined;

    const skillChildren: DropdownItem[] = canCreateSkill
      ? [
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
        ]
      : [];
    // A query naming the Skill group keeps both children; otherwise only the matching ones.
    const visibleSkillChildren = isMatch(labels.createSkill)
      ? skillChildren
      : skillChildren.filter((child) => isMatch(String(child.label)));

    const promptOption: DropdownItem | undefined =
      isPromptCreatable && isMatch(labels.createPrompt)
        ? {
            key: 'prompt',
            label: labels.createPrompt,
            onClick: () => onNavigate(urls.buildPromptCreateUrl()),
          }
        : undefined;

    return {
      runnerOptions,
      toolsetOption,
      customAppOption,
      visibleSkillChildren,
      promptOption,
    };
  }, [
    createSearchQuery,
    creatableRunnerSchemas,
    onNavigate,
    urls,
    isPromptCreatable,
    labels,
    isToolsetCreatable,
    isCustomAppCreatable,
    canCreateSkill,
    onSkillUploadClick,
  ]);

  const createOptions = useMemo<DropdownItem[]>(() => {
    const {
      runnerOptions,
      toolsetOption,
      customAppOption,
      visibleSkillChildren,
      promptOption,
    } = createMenuParts;
    const entityOptions: DropdownItem[] = [];
    if (toolsetOption) entityOptions.push(toolsetOption);
    if (visibleSkillChildren.length > 0) {
      entityOptions.push({
        key: 'skill',
        label: labels.createSkill,
        children: visibleSkillChildren,
      });
    }
    if (promptOption) entityOptions.push(promptOption);
    const runnerSectionOptions = sortByLabel(
      customAppOption ? [customAppOption, ...runnerOptions] : runnerOptions,
    );
    const entitySectionOptions = sortByLabel(entityOptions);

    // A header over an emptied section would be noise, so the sections merge into one list then.
    if (
      entitySectionOptions.length === 0 ||
      runnerSectionOptions.length === 0
    ) {
      return [...entitySectionOptions, ...runnerSectionOptions];
    }
    return [
      ...entitySectionOptions,
      { key: 'create-sections-divider', type: DropdownItemType.Divider },
      {
        key: 'runners-header',
        type: DropdownItemType.PlainText,
        label: labels.createRunners,
      },
      ...runnerSectionOptions,
    ];
  }, [createMenuParts, labels.createSkill, labels.createRunners]);

  const createSearch = useMemo<CatalogCreateSearch | undefined>(
    () =>
      creatableRunnerSchemas.length > 0
        ? { value: createSearchQuery, onChange: setCreateSearchQuery }
        : undefined,
    [creatableRunnerSchemas.length, createSearchQuery],
  );

  const createMenuByType = useMemo<
    Partial<Record<CatalogEntityType, CatalogTabCreateMenu>>
  >(() => {
    const {
      runnerOptions,
      toolsetOption,
      customAppOption,
      visibleSkillChildren,
      promptOption,
    } = createMenuParts;
    // Models are never created from the catalog, so they get no entry.
    return {
      [CatalogEntityType.Agent]: {
        options: sortByLabel(
          customAppOption ? [...runnerOptions, customAppOption] : runnerOptions,
        ),
        search: createSearch,
      },
      [CatalogEntityType.Toolset]: {
        options: toolsetOption ? [toolsetOption] : [],
      },
      [CatalogEntityType.Skill]: { options: visibleSkillChildren },
      [CatalogEntityType.Prompt]: {
        options: promptOption ? [promptOption] : [],
      },
    };
  }, [createMenuParts, createSearch]);

  return {
    handleEdit,
    handleDelete,
    createOptions,
    createSearch,
    createMenuByType,
    hasCreateOptions,
  };
};
