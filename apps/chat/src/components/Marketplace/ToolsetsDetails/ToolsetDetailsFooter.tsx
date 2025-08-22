import { ToolsetModel } from '@/src/types/toolsets';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';

import { AgentBookmark } from '../AgentBookmark';

interface Props {
  entity: ToolsetModel;
  allVersions: ToolsetModel[];
  onChangeVersion: (entity: ToolsetModel) => void;

  onBookmarkClick: (entity: ToolsetModel) => void;
}

export function ToolsetDetailsFooter({
  entity,
  allVersions,
  onChangeVersion,

  onBookmarkClick,
}: Props) {
  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Render context menu here */}

          <AgentBookmark
            entity={entity}
            size={24}
            className="icon-button group/bookmark"
            onBookmarkClick={onBookmarkClick}
          />
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
          />
        </div>
      </div>
    </section>
  );
}
