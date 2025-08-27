import { useCallback, useEffect } from 'react';

import { useRouter } from 'next/router';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, WidgetsSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

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
