import { useCallback, useEffect } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useScreenState } from '../hooks/useScreenState';
import { useWidgets } from '../hooks/useWidgets';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '../types/common';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { Routes } from '@/src/constants/routes';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { CloseSidebarButton } from './Buttons/CloseSidebarButton';
import { withRenderWhen } from './Common/RenderWhen';

export const WidgetbarView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const dispatch = useAppDispatch();

  const screenState = useScreenState();

  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const { widgetModels, handleWidgetClick } = useWidgets();

  const handleCloseClick = useCallback(() => {
    dispatch(UIActions.setShowWidgetbar(false));
  }, [dispatch]);

  useEffect(() => {
    if (screenState !== ScreenState.SM) {
      dispatch(UIActions.setShowWidgetbar(false));
    }
  }, [dispatch, screenState]);

  return (
    <div className="fixed left-0 z-40 flex h-full w-[260px] max-w-[260px]">
      <div className="flex w-full flex-col divide-y divide-tertiary bg-layer-3 transition-all">
        <div className="px-5 py-[12px] text-base font-semibold text-primary">
          {t('Widgets')}
        </div>

        <div className="flex grow flex-col gap-px overflow-y-auto p-2">
          {widgetModels.map((model) => (
            <button
              key={model.reference}
              onClick={() => handleWidgetClick(model.reference)}
              className={classNames(
                'flex w-full shrink-0 items-center gap-2 truncate rounded border-l border-transparent px-[10px] py-[5px] hover:bg-accent-primary-alpha',
                {
                  '!border-accent-primary bg-accent-primary-alpha':
                    model.reference === selectedWidget &&
                    router.route === Routes.Chat,
                },
              )}
            >
              <ModelIcon entityId={model.id} entity={model} size={24} />
              <span className="truncate text-sm text-primary">
                {model.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      <CloseSidebarButton onClose={handleCloseClick} isLeftSide />
    </div>
  );
};

export const Widgetbar = withRenderWhen(UISelectors.selectShowWidgetbar)(
  WidgetbarView,
);
