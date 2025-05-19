import { createSelector } from '@reduxjs/toolkit';

import { SettingsSelectors } from '../settings/settings.selectors';
import { ModelsSelectors } from './models.selectors';

const selectWidgetsSchemaIds = createSelector(
  [SettingsSelectors._selectWidgetsSchemaIds],
  (widgetsSchemaIds) => new Set(widgetsSchemaIds),
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

const selectIsAnyWidget = createSelector([selectWidgets], (widgets) => {
  return widgets.length > 0;
});

export const WidgetsSelectors = {
  selectWidgets,
  selectIsAnyWidget,
  selectWidgetsSchemaIds,
};
