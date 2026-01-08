import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';
import { useResetSelectedWidget, useWidgets } from '@/src/hooks/useWidgets';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { Translation } from '@/src/types/translation';

import { Routes } from '@/src/constants/routes';

import { getLayout } from '@/src/pages/_app';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { WidgetsHeader } from '@/src/components/WidgetsHeader';

function WidgetsPage() {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const { widgetModels, handleWidgetClick } = useWidgets();

  useEffect(() => {
    if (!isSmallScreen()) {
      router.push(Routes.Chat);
    }
  }, [router]);

  useResetSelectedWidget();

  return (
    <div className="flex size-full flex-col divide-y divide-tertiary bg-layer-1">
      <WidgetsHeader />

      <div className="flex grow flex-col gap-2 overflow-y-auto p-3">
        {widgetModels.map((model) => (
          <button
            key={model.reference}
            onClick={() => handleWidgetClick(model.reference)}
            className="flex w-full shrink-0 items-center gap-2 truncate rounded bg-layer-2 p-3 hover:bg-accent-primary-alpha"
          >
            <ModelIcon entityId={model.id} entity={model} size={40} />

            <div className="flex flex-col justify-center gap-1 truncate">
              <span className="text-start text-xs text-secondary">
                {`${t('Version')}: ${model.version}`}
              </span>
              <span className="truncate text-start text-sm font-semibold text-primary">
                {model.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

WidgetsPage.getLayout = getLayout;

export default WidgetsPage;

export const getServerSideProps = getCommonPageProps;
