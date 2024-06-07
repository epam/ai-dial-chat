import { useCallback } from 'react';

import { FeatureType } from '../types/common';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { UIActions, UISelectors } from '../store/ui/ui.reducers';

import uniq from 'lodash-es/uniq';

export const useSectionToggle = (
  sectionName: string,
  featureType: FeatureType,
) => {
  const dispatch = useAppDispatch();

  const collapsedSections = useAppSelector((state) =>
    UISelectors.selectCollapsedSections(state, featureType),
  );

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
    isCollapsed: !collapsedSections.includes(sectionName),
  };
};
