import type { ToolsetBodyDto } from '@epam/ai-dial-chat-api-client';
import type { ResourceSaveAdapter } from '@epam/ai-dial-chat-hooks';
import {
  createToolset,
  moveToolset,
  updateToolset,
} from '../../server-api/toolsets';

/** Parameters for {@link createToolsetSaveAdapter}. */
export interface ToolsetSaveAdapterParams {
  /** Full id of the edited toolset. */
  toolsetId: string;
  /** The edited values, already mapped to the write body. */
  body: ToolsetBodyDto;
}

/**
 * Save operations for a toolset. A new version is a create-only write of the
 * edited values into the chosen folder, so the stored current version is
 * never touched.
 */
export const createToolsetSaveAdapter = ({
  toolsetId,
  body,
}: ToolsetSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'toolset',
  isVersioned: true,
  saveInPlace: () => updateToolset(toolsetId, body),
  saveAsNewVersion: (version, folderPath) =>
    createToolset({
      ...body,
      version,
      createOnly: true,
      ...(folderPath.length > 0 ? { folderPath: folderPath.join('/') } : {}),
    }),
  move: (id, folderPath) => moveToolset(id, folderPath.join('/')),
});
