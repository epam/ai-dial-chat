import type {
  ApplicationsApi,
  PromptsApi,
  ResourceFoldersResponseDto,
  ToolsetBodyDto,
  ToolsetsApi,
  UpdatePromptDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ResourceSaveError,
  type ResourceSaveAdapter,
  type SavedResource,
} from './resource-save';

/** The application operations the application save adapters call. */
export type ResourceSaveApplicationsApi = Pick<
  ApplicationsApi,
  | 'moveApplication'
  | 'forkApplicationVersion'
  | 'commitApplicationVersion'
  | 'deleteApplication'
>;

/** The toolset operations {@link createToolsetSaveAdapter} calls. */
export type ResourceSaveToolsetsApi = Pick<
  ToolsetsApi,
  'updateToolset' | 'createToolset' | 'moveToolset'
>;

/** The prompt operations {@link createPromptSaveAdapter} and {@link createPromptFolderLister} call. */
export type ResourceSavePromptsApi = Pick<
  PromptsApi,
  'listPrompts' | 'updatePrompt' | 'movePrompt'
>;

/** Parameters for {@link createEmbeddedApplicationSaveAdapter}. */
export interface EmbeddedApplicationSaveAdapterParams {
  /** Configured applications client. */
  applicationsApi: ResourceSaveApplicationsApi;
  /** Full id of the edited application. */
  applicationId: string;
  /** Runs the embedded editor's own save of the edited application. */
  runEmbeddedSave: () => Promise<void>;
  /** Translated message for a fork whose commit failed, naming the new version. */
  getCommitFailedMessage: (version: string) => string;
}

/** Parameters for {@link createHostApplicationSaveAdapter}. */
export interface HostApplicationSaveAdapterParams {
  /** Configured applications client. */
  applicationsApi: Pick<ResourceSaveApplicationsApi, 'moveApplication'>;
  /** Full id of the edited application. */
  applicationId: string;
  /** Writes the edited values to the application in place. */
  update: () => Promise<unknown>;
  /** Creates the edited values as a new application with `version` in `folderPath`, never overwriting. */
  createVersion: (
    version: string,
    folderPath: string[],
  ) => Promise<{ id?: string } | void>;
}

/** Parameters for {@link createToolsetSaveAdapter}. */
export interface ToolsetSaveAdapterParams {
  /** Configured toolsets client. */
  toolsetsApi: ResourceSaveToolsetsApi;
  /** Full id of the edited toolset. */
  toolsetId: string;
  /** The edited values, already mapped to the write body. */
  body: ToolsetBodyDto;
}

/** Parameters for {@link createPromptSaveAdapter}. */
export interface PromptSaveAdapterParams {
  /** Configured prompts client. */
  promptsApi: Pick<ResourceSavePromptsApi, 'updatePrompt' | 'movePrompt'>;
  /** Full id of the edited prompt. */
  promptId: string;
  /** The edited values. */
  body: UpdatePromptDto;
}

const moveApplicationToFolder =
  (applicationsApi: Pick<ResourceSaveApplicationsApi, 'moveApplication'>) =>
  (id: string, folderPath: string[]): Promise<SavedResource> =>
    applicationsApi.moveApplication({
      applicationName: id,
      moveResourceDto: { folderPath: folderPath.join('/') },
    });

/**
 * Save operations for an application whose embedded editor is the single
 * writer (Quick Apps). A new version is a fork of the stored application,
 * the editor's save to the original, then a commit that swaps the two
 * bodies, so the edits land in the new version and the original keeps its
 * last saved content.
 */
export const createEmbeddedApplicationSaveAdapter = ({
  applicationsApi,
  applicationId,
  runEmbeddedSave,
  getCommitFailedMessage,
}: EmbeddedApplicationSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: async () => {
    await runEmbeddedSave();
    return { id: applicationId };
  },
  saveAsNewVersion: async (version, folderPath) => {
    const { id: snapshotId } = await applicationsApi.forkApplicationVersion({
      applicationName: applicationId,
      forkApplicationVersionDto: { version, folderPath: folderPath.join('/') },
    });
    try {
      await runEmbeddedSave();
    } catch (error) {
      // Nothing was committed, so the snapshot must not survive as a stray version.
      await applicationsApi
        .deleteApplication({ applicationName: snapshotId })
        .catch(() => undefined);
      throw error;
    }
    try {
      return await applicationsApi.commitApplicationVersion({
        applicationName: applicationId,
        commitApplicationVersionDto: { snapshotId },
      });
    } catch {
      throw new ResourceSaveError(getCommitFailedMessage(version));
    }
  },
  move: moveApplicationToFolder(applicationsApi),
});

/**
 * Save operations for an application the host writes itself (schema-form
 * and custom apps). A new version is a create-only write of the edited
 * values, so the stored current version is never touched.
 */
export const createHostApplicationSaveAdapter = ({
  applicationsApi,
  applicationId,
  update,
  createVersion,
}: HostApplicationSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: async () => {
    await update();
    return { id: applicationId };
  },
  saveAsNewVersion: async (version, folderPath) => {
    const created = await createVersion(version, folderPath);
    if (!created?.id) throw new Error('Created version has no id');
    return { id: created.id };
  },
  move: moveApplicationToFolder(applicationsApi),
});

/** Save operations for a toolset; a new version is a create-only write into the chosen folder. */
export const createToolsetSaveAdapter = ({
  toolsetsApi,
  toolsetId,
  body,
}: ToolsetSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'toolset',
  isVersioned: true,
  saveInPlace: () =>
    toolsetsApi.updateToolset({ toolsetName: toolsetId, toolsetBodyDto: body }),
  saveAsNewVersion: (version, folderPath) =>
    toolsetsApi.createToolset({
      createToolsetBodyDto: {
        ...body,
        version,
        createOnly: true,
        ...(folderPath.length > 0 ? { folderPath: folderPath.join('/') } : {}),
      },
    }),
  move: (id, folderPath) =>
    toolsetsApi.moveToolset({
      toolsetName: id,
      moveResourceDto: { folderPath: folderPath.join('/') },
    }),
});

/** Save operations for a prompt: unversioned, so it is updated in place and then moved when its folder changes. */
export const createPromptSaveAdapter = ({
  promptsApi,
  promptId,
  body,
}: PromptSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'prompt',
  isVersioned: false,
  // A rename changes the prompt's id, so the id the update returns is the one moved next.
  saveInPlace: () =>
    promptsApi.updatePrompt({ id: promptId, updatePromptDto: body }),
  move: (id, folderPath) =>
    promptsApi.movePrompt({
      id,
      movePromptDto: { targetFolderId: folderPath.join('/') },
    }),
});

/** Returns a lister of the caller's prompt folders directly under `path` (plain text, `''` for the root). */
export const createPromptFolderLister =
  (promptsApi: Pick<ResourceSavePromptsApi, 'listPrompts'>) =>
  async (path: string): Promise<ResourceFoldersResponseDto> => {
    // The prompt listing returns every folder at once, each id being its plain path.
    const { folders } = await promptsApi.listPrompts();
    const prefix = path ? `${path}/` : '';
    return {
      folders: folders
        .filter(
          (folder) =>
            folder.id.startsWith(prefix) &&
            folder.id.length > prefix.length &&
            !folder.id.slice(prefix.length).includes('/'),
        )
        .map((folder) => ({ name: folder.name, path: folder.id })),
    };
  };
