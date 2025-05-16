import { createSelector } from '@reduxjs/toolkit';

import { ModelsSelectors } from '../models/models.selectors';
import { SettingsSelectors } from '../settings/settings.selectors';

const selectWidgetsSchemaIds = createSelector(
  [SettingsSelectors._selectWidgetsSchemaIds],
  (widgetsSchemaIds) => new Set(widgetsSchemaIds),
);

const selectIsAnyWidget = createSelector(
  [selectWidgetsSchemaIds],
  (widgetsSchemaIds) => {
    return widgetsSchemaIds.size > 0;
  },
);

const selectWidgets = createSelector(
  [ModelsSelectors.selectModels, selectWidgetsSchemaIds],
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
  selectWidgetsSchemaIds,
};
