import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { ApplicationActions } from '../store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ModelsSelectors } from '../store/models/models.reducers';
import { SettingsSelectors } from '../store/settings/settings.selectors';
import { UIActions } from '../store/ui/ui.reducers';

import { Routes } from '../constants/routes';

export const useWidgets = () => {
  const router = useRouter();

  const dispatch = useAppDispatch();

  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);

  const widgetModels = useMemo(() => {
    return models
      .filter((m) => widgetsSchemaIds.has(m.applicationTypeSchemaId ?? ''))
      .toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
  }, [models, widgetsSchemaIds]);

  const handleSelectWidget = useCallback(
    (id: string) => {
      dispatch(ApplicationActions.selectWidget(id));
    },
    [dispatch],
  );

  const handleWidgetClick = useCallback(
    (id: string) => {
      if (router.route !== Routes.Chat) {
        router.push(Routes.Chat).then(() => handleSelectWidget(id));
      } else {
        handleSelectWidget(id);
      }
      dispatch(UIActions.setShowWidgetbar(false));
    },
    [dispatch, handleSelectWidget, router],
  );

  return { widgetModels, handleWidgetClick };
};
