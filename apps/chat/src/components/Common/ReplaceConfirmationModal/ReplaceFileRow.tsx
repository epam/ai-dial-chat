import { IconFile } from '@tabler/icons-react';

import { DialFile } from '@/src/types/files';

import { Tooltip } from '../Tooltip';
import { EntityRow, FeatureRowProps } from './ReplaceEntityRow';
import { FeatureContainer } from './ReplaceRowContainer';

interface FileViewProps {
  item: DialFile;
}

const FileView = ({ item: file }: FileViewProps) => {
  return (
    <FeatureContainer>
      <span className="flex shrink-0">
        <IconFile size={18} className="text-secondary" />
      </span>
      <Tooltip
        tooltip={file.name}
        contentClassName="break-all"
        triggerClassName="truncate whitespace-pre"
        dataQa="entity-name"
      >
        {file.name}
      </Tooltip>
    </FeatureContainer>
  );
};

interface FileRowProps extends FileViewProps, FeatureRowProps {}

export const FilesRow = ({
  item,
  additionalItemData,
  level,
  onEvent,
}: FileRowProps) => {
  return (
    <EntityRow
      entityId={item.id}
      additionalItemData={additionalItemData}
      level={level}
      onEvent={onEvent}
      dataQA="file"
    >
      <FileView item={item} />
    </EntityRow>
  );
};
