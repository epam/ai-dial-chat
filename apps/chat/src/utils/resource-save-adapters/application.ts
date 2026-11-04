import {
  commitApplicationVersion,
  deleteApplication,
  forkApplicationVersion,
  moveApplication,
} from '../../server-api/applications';
import {
  ResourceSaveError,
  type ResourceSaveAdapter,
  type SavedResource,
} from '@epam/ai-dial-chat-hooks';

/** Parameters for {@link createEmbeddedApplicationSaveAdapter}. */
export interface EmbeddedApplicationSaveAdapterParams {
  /** Full id of the edited application. */
  applicationId: string;
  /** Runs the embedded editor's own save of the edited application. */
  runEmbeddedSave: () => Promise<void>;
  /** Translated message for a fork whose commit failed, naming both versions. */
  getCommitFailedMessage: (version: string) => string;
}

/** Parameters for {@link createHostApplicationSaveAdapter}. */
export interface HostApplicationSaveAdapterParams {
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

/** Moves an application into a Personal folder; resolves with its new id. */
const moveApplicationToFolder = (
  id: string,
  folderPath: string[],
): Promise<SavedResource> => moveApplication(id, folderPath.join('/'));

/**
 * Save operations for an application whose embedded editor is the single
 * writer (Quick Apps). The editor can only write to the application it was
 * opened on, so a new version is a fork of the stored application, the
 * editor's save to the original, then a commit that swaps the two bodies:
 * the edits end up in the new version and the original keeps its last
 * saved content.
 */
export const createEmbeddedApplicationSaveAdapter = ({
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
    const { id: snapshotId } = await forkApplicationVersion(
      applicationId,
      version,
      folderPath.join('/'),
    );
    try {
      await runEmbeddedSave();
    } catch (error) {
      // Nothing was committed, so the snapshot must not survive as a stray version.
      await deleteApplication(snapshotId).catch(() => undefined);
      throw error;
    }
    try {
      return await commitApplicationVersion(applicationId, snapshotId);
    } catch {
      throw new ResourceSaveError(getCommitFailedMessage(version));
    }
  },
  move: moveApplicationToFolder,
});

/**
 * Save operations for an application the host writes itself (schema-form and
 * custom apps). A new version is a create-only write of the edited values,
 * so the stored current version is never touched.
 */
export const createHostApplicationSaveAdapter = ({
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
  move: moveApplicationToFolder,
});
