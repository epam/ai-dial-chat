import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { convertApplicationFromApi } from '@/src/utils/app/application';

import { ApiApplicationResponse } from '@/src/types/applications';

import { ApplicationActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, SettingsSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { IframeRenderer } from '@/src/components/IframeRenderer';

import { VisualizerConnectorRequest } from '@epam/ai-dial-shared';

interface Props {
  id: string;
  host: string;
  theme: string;
  title: string;
}

export const CustomApplicationEditorView: React.FC<Props> = ({
  id,
  host,
  theme,
  title,
}) => {
  const providerId = useAppSelector(SettingsSelectors.selectProviderId);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${host}?authProvider=${providerId}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      router.push(Routes.NotFound);
    }
  }, [host, id, providerId, router, theme]);

  const onMessage = useCallback(
    (event: MessageEvent<VisualizerConnectorRequest>) => {
      if (event.data?.type?.split('/')[0] !== title) return;

      if (event.data.type === `${title}/UPDATED_APPLICATION_SUCCESS`) {
        const { application } = event.data.payload as unknown as {
          application?: ApiApplicationResponse;
        };
        if (application && applicationData) {
          const convertedApplication = convertApplicationFromApi(application);

          dispatch(ApplicationActions.updateSuccess(convertedApplication));
          dispatch(
            ModelsActions.updateModel({
              model: convertedApplication,
              oldApplicationId: applicationData.id,
            }),
          );
        }
      }
    },
    [title, applicationData, dispatch],
  );

  return (
    <div className="size-full">
      <IframeRenderer
        iframeUrl={generateTargetUrl()?.href ?? ''}
        title={title}
        width="100%"
        height="100%"
        containerClassName="w-full h-full border-none transition-all"
        onMessage={onMessage}
      />
    </div>
  );
};
