import { useCallback, useEffect, useMemo } from 'react';

import { useRouter } from 'next/router';

import { WidgetsSelectors } from '../store/widgets/widgets.selectors';
import { ApplicationActions } from '@/src/store/actions';
import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { Routes } from '../constants/routes';

export const useWidgets = () => {
  const router = useRouter();

  const widgetModels = useAppSelector(WidgetsSelectors.selectWidgets);

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
