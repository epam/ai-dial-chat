import { IconBrowser, IconProps } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useWidgets } from '@/src/hooks/useWidgets';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  WidgetsSelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { ModelIcon, ModelTooltip } from '@/src/components/Chatbar/ModelIcon';
import { Loader } from '@/src/components/Common/Loader';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { NavigationButton } from './NavigationButton';

const WidgetBarIcon: React.FC<IconProps> = ({ height, ...rest }) => {
  const { widgetModels } = useWidgets();

  const isApplicationsInitialized = useAppSelector(
    ApplicationSelectors.selectInitialized,
  );
  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );
  const selectedWidgetId = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const selectedWidget = useMemo(
    () => widgetModels.find((model) => model.reference === selectedWidgetId),
    [widgetModels, selectedWidgetId],
  );

  if (areModelsLoading || !isApplicationsInitialized) {
    return <Loader size={height as number} />;
  }

  return selectedWidget ? (
    <ModelIcon
      entity={selectedWidget}
      entityId={selectedWidget.reference}
      size={height as number}
    />
  ) : (
    <IconBrowser height={height} {...rest} />
  );
};

const WidgetsNavigationView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const selectedWidgetId = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );

  const { widgetModels, handleWidgetClick } = useWidgets();

  const screenState = useScreenState();

  const handleOpenWidgetsClick = useCallback(() => {
    if (router.route === Routes.SelectedWidget) return;
    if (selectedWidgetId && router.route !== Routes.SelectedWidget) {
      handleWidgetClick(selectedWidgetId);
    } else {
      router.push(Routes.Widgets);
    }
  }, [handleWidgetClick, router, selectedWidgetId]);

  if (!widgetModels.length && !areModelsLoading) return null;

  if (screenState === ScreenState.SM) {
    return (
      <NavigationButton
        onClick={handleOpenWidgetsClick}
        Icon={WidgetBarIcon}
        selected={
          router.route === Routes.Widgets ||
          router.route === Routes.SelectedWidget
        }
        dataQa="widgets-sidebar-trigger"
        caption={t('Widgets')}
        tooltip={t('Widgets')}
        allowClickSelected={router.route === Routes.SelectedWidget}
      />
    );
  }

  return (
    <div className="no-scrollbar hidden w-full flex-col items-center gap-2 overflow-y-auto border-t border-tertiary pt-2 empty:border-transparent md:flex">
      {widgetModels.map((model) => (
        <NavigationButton
          key={model.reference}
          rounded
          onClick={() => handleWidgetClick(model.reference)}
          selected={
            model.reference === selectedWidgetId &&
            router.route === Routes.SelectedWidget
          }
          Icon={({ height }) => (
            <ModelIcon
              entity={model}
              entityId={model.id}
              size={height as number}
              isCustomTooltip
            />
          )}
          tooltip={<ModelTooltip entity={model} entityId={model.id} />}
        />
      ))}
    </div>
  );
};

export const WidgetsNavigation = withRenderWhen(
  WidgetsSelectors.selectIsAnyWidget,
)(WidgetsNavigationView);
