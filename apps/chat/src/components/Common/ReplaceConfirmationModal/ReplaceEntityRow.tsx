import { ReactElement, useCallback, useEffect, useState } from 'react';

import { AdditionalItemData, ReplaceOptions } from '@/src/types/common';

import { ReplaceSelector } from './ReplaceSelector';

interface EntityRowProps {
  children: ReactElement;
  entityId: string;
  dataQA: string;
  additionalItemData?: AdditionalItemData;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
}

export interface FeatureRowProps {
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: AdditionalItemData;
}

export const EntityRow = ({
  children,
  entityId,
  dataQA,
  additionalItemData,
  onEvent,
}: EntityRowProps) => {
  const [selectedOption, setSelectedOption] = useState<ReplaceOptions>(
    ReplaceOptions.Postfix,
  );

  const handleOptionChange = useCallback(
    (option: string) => {
      const typedOption = option as ReplaceOptions;
      onEvent && onEvent(typedOption, entityId);
      setSelectedOption(typedOption);
    },
    [onEvent, entityId],
  );

  useEffect(() => {
    setSelectedOption(
      () =>
        additionalItemData?.mappedActions?.[entityId] ?? ReplaceOptions.Postfix,
    );
  }, [additionalItemData, additionalItemData?.mappedActions, entityId]);

  return (
    <div
      className="flex h-[38px] justify-between hover:rounded hover:bg-accent-primary-alpha"
      data-qa={dataQA}
    >
      {children}
      {!!additionalItemData?.mappedActions && (
        <ReplaceSelector
          selectedOption={selectedOption}
          onOptionChangeHandler={handleOptionChange}
        />
      )}
    </div>
  );
};
