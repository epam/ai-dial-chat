import { useCallback, useMemo } from 'react';

import { FeatureType } from '@/src/types/common';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import uniq from 'lodash-es/uniq';

export const useSectionToggle = (
  sectionName: string,
  featureType: FeatureType,
) => {
  const dispatch = useAppDispatch();

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(featureType),
    [featureType],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);

  const handleToggle = useCallback(
    (isOpen: boolean) => {
      const newCollapsedSections = isOpen
        ? collapsedSections.filter((section) => section !== sectionName)
        : uniq([...collapsedSections, sectionName]);

      dispatch(
        UIActions.setCollapsedSections({
          featureType,
          collapsedSections: newCollapsedSections,
        }),
      );
    },
    [collapsedSections, dispatch, featureType, sectionName],
  );

  return {
    handleToggle,
    isExpanded: !collapsedSections.includes(sectionName),
  };
};
