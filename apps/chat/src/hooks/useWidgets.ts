import { useCallback, useEffect, useMemo } from 'react';

import { useRouter } from 'next/router';

import { ApplicationSelectors } from '../store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ModelsSelectors } from '../store/models/models.reducers';
import { SettingsSelectors } from '../store/settings/settings.selectors';
import { ApplicationActions } from '@/src/store/actions';

import { Routes } from '../constants/routes';

export const useWidgets = () => {
  const router = useRouter();

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

  const handleWidgetClick = useCallback(
    (id: string) => {
      router.push(Routes.SelectedWidget.replace('[slug]', id));
    },
    [router],
  );

  return { widgetModels, handleWidgetClick };
};

export const useResetSelectedWidget = (widgetId?: string) => {
  const dispatch = useAppDispatch();
  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );
  useEffect(() => {
    if (selectedWidget !== widgetId) {
      dispatch(ApplicationActions.setSelectedWidget(widgetId));
    }
  }, [dispatch, selectedWidget, widgetId]);
};
