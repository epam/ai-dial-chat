import { ReactNode } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { DialFile, FileSourceType } from '@/src/types/files';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';

import { FeatureType, FolderInterface } from '@epam/ai-dial-shared';

interface FilesSectionProps {
  name: string;
  dataQa: string;
  children: ReactNode;
  files: DialFile[];
  folders: FolderInterface[];
  sourceType: FileSourceType;
  filters?: Set<FileSourceType>;
}

export const FilesSectionWrapper = ({
  name,
  dataQa,
  folders,
  files,
  children,
  sourceType,
  filters,
}: FilesSectionProps) => {
  const { handleToggle, isExpanded } = useSectionToggle(name, FeatureType.File);

  const isNothingExists = folders.length === 0 && files.length === 0;

  if (isNothingExists || (filters && !filters.has(sourceType))) return null;

  return (
    <CollapsibleSection
      onToggle={handleToggle}
      name={name}
      openByDefault={isExpanded}
      dataQa={dataQa}
      className="!p-0"
      togglerClassName="ml-0.5"
    >
      <div
        className="flex flex-col overflow-auto"
        data-qa="file-section-content"
      >
        <div className="flex grow flex-col gap-0.5 overflow-auto">
          {children}
        </div>
      </div>
    </CollapsibleSection>
  );
};
