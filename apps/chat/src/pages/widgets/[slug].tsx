import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Routes } from '@/src/constants/routes';

import { getLayout } from '@/src/pages/_app';

import { WidgetView } from '@/src/components/Chat/WidgetView';
import Loader from '@/src/components/Common/Loader';
import { WidgetsHeader } from '@/src/components/WidgetsHeader';

function SelectedWidgetPage() {
  const router = useRouter();

  const { slug: widgetId } = router.query;

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);

  const widget = widgetId ? modelsMap[widgetId as string] : null;

  useEffect(() => {
    if (!widget && !isModelsLoading) {
      router.push(Routes.NotFound);
    }
  }, [isModelsLoading, router, widget]);

  return (
    <div className="flex size-full flex-col divide-y divide-tertiary bg-layer-1">
      <WidgetsHeader />

      {isModelsLoading && (
        <div className="flex grow items-center justify-center">
          <Loader />
        </div>
      )}
      {!isModelsLoading && widget && (
        <div className="flex grow">
          <WidgetView id={widget.reference} />
        </div>
      )}
    </div>
  );
}

SelectedWidgetPage.getLayout = getLayout;

export default SelectedWidgetPage;

export const getServerSideProps = getCommonPageProps;
