import { IconBrowser, IconProps } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';
import { useWidgets } from '@/src/hooks/useWidgets';

import { Translation } from '@/src/types/translation';

import { WidgetsSelectors } from '../../store/widgets/widgets.selectors';
import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { Routes } from '@/src/constants/routes';

import { ModelIcon, ModelTooltip } from '@/src/components/Chatbar/ModelIcon';
import Loader from '@/src/components/Common/Loader';

import { withRenderWhen } from '../Common/RenderWhen';
import { NavigationButton } from './NavigationButton';

const WidgetsNavigationView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const selectedWidgetId = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );
  const isApplicationsInitialised = useAppSelector(
    ApplicationSelectors.selectInitialized,
  );

  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );

  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );

  const { widgetModels, handleWidgetClick } = useWidgets();

  const handleOpenWidgetsClick = useCallback(() => {
    if (router.route === Routes.SelectedWidget) return;
    if (selectedWidgetId && router.route !== Routes.SelectedWidget) {
      handleWidgetClick(selectedWidgetId);
    } else {
      router.push(Routes.Widgets);
    }
  }, [handleWidgetClick, router, selectedWidgetId]);

  const selectedWidget = useMemo(
    () => widgetModels.find((model) => model.reference === selectedWidgetId),
    [widgetModels, selectedWidgetId],
  );

  const WidgetBarIcon = useMemo(() => {
    if (areModelsLoading || !isApplicationsInitialised)
      // eslint-disable-next-line react/display-name
      return ({ height }: IconProps) => <Loader size={height as number} />;

    return selectedWidget
      ? ({ height }: IconProps) => (
          <ModelIcon
            entity={selectedWidget}
            entityId={selectedWidget.reference}
            size={height as number}
          />
        )
      : IconBrowser;
  }, [isApplicationsInitialised, areModelsLoading, selectedWidget]);

  if (!widgetModels.length && !areModelsLoading) return null;

  return (
    <>
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

      <div className="md:hidden">
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
      </div>
    </>
  );
};

export const WidgetsNavigation = withRenderWhen(
  WidgetsSelectors.selectIsAnyWidget,
)(WidgetsNavigationView);
