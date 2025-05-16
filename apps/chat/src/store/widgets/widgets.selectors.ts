import { createSelector } from '@reduxjs/toolkit';

import { ModelsSelectors } from '../models/models.selectors';
import { SettingsSelectors } from '../settings/settings.selectors';

const selectIsAnyWidget = createSelector(
  [SettingsSelectors.selectWidgetsSchemaIds],
  (widgetsSchemaIds) => {
    return widgetsSchemaIds.size > 0;
  },
);

const selectWidgets = createSelector(
  [ModelsSelectors.selectModels, SettingsSelectors.selectWidgetsSchemaIds],
  (models, widgetsSchemaIds) => {
    return models
      .filter((m) => widgetsSchemaIds.has(m.applicationTypeSchemaId ?? ''))
      .toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
  },
);

export const WidgetsSelectors = {
  selectWidgets,
  selectIsAnyWidget,
};
