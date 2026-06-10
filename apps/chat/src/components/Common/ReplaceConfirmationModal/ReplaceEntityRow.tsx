import { ReactElement, useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { AdditionalItemData, ReplaceOptions } from '@/src/types/common';

import { ReplaceSelector } from './ReplaceSelector';

export interface FeatureRowProps {
  additionalItemData?: AdditionalItemData;
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
}

interface EntityRowProps extends FeatureRowProps {
  children: ReactElement;
  entityId: string;
  dataQA: string;
  itemComponentClassNames?: string;
}

export const EntityRow = ({
  children,
  entityId,
  dataQA,
  additionalItemData,
  itemComponentClassNames,
  level = 0,
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
      className={classNames(
        'flex h-[38px] justify-between hover:rounded hover:bg-accent-primary-alpha',
        itemComponentClassNames,
      )}
      style={{ paddingLeft: `${level * 24}px` }}
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
