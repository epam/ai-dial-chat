import { createSelector } from '@reduxjs/toolkit';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { ModelsSelectors } from './models.selectors';

const selectWidgetsSchemaIds = createSelector(
  [(state) => SettingsSelectors.selectWidgetsSchemaIds(state)],
  (widgetsSchemaIds) => new Set(widgetsSchemaIds),
);

const selectWidgets = createSelector(
  [(state) => ModelsSelectors.selectModels(state), selectWidgetsSchemaIds],
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
