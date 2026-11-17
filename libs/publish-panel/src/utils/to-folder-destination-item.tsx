import { EntityHeader } from '@epam/ai-dial-chat-shared';
import type { FolderDestinationItem } from '@epam/ai-dial-react-file-manager';
import type { PublishResourceSummary } from '../models/publish';

/**
 * Maps the resource being saved to the item the folder destination panel
 * shows. The panel knows nothing about catalog entities, so a typed resource
 * is rendered here as an entity header (icon, type label, name and version)
 * and handed over as the summary row's content.
 */
export const toFolderDestinationItem = (
  resource: PublishResourceSummary,
): FolderDestinationItem => ({
  title: resource.title,
  summary:
    resource.type != null ? (
      <div className="min-w-0 flex-1">
        <EntityHeader
          item={{
            type: resource.type,
            name: resource.title,
            version: resource.version ?? '',
            iconUrl: resource.iconUrl,
          }}
          iconSize={40}
          hasFeaturedTag={false}
        />
      </div>
    ) : undefined,
});
