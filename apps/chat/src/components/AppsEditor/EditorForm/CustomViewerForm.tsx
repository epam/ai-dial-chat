import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { convertApplicationFromApi } from '@/src/utils/app/application';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApiApplicationResponse } from '@/src/types/applications';

import { ApplicationActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { IframeRenderer } from '@/src/components/IframeRenderer';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
} from '@epam/ai-dial-shared';

export const CustomViewerForm = () => {
  const providerId = useAppSelector(SettingsSelectors.selectProviderId);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const theme = useAppSelector(UISelectors.selectThemeState);
  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const id = applicationData?.id ?? '';
  const host =
    schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl] ?? '';
  const title =
    schema?.[ApplicationTypeSchemaProperties.applicationTypeDisplayName] ?? '';

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${host}?authProvider=${providerId}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('NotFound: CustomViewerForm', error);
      router.push(Routes.NotFound);
    }
  }, [host, id, providerId, router, theme]);

  const onMessage = useCallback(
    (event: MessageEvent<VisualizerConnectorRequest>) => {
      if (event.data?.type?.split('/')[0] !== title) return;

      if (
        event.data.type ===
        `${title}/${VisualizerConnectorEvents.updatedApplicationSuccess}`
      ) {
        const { application } = event.data.payload as unknown as {
          application?: ApiApplicationResponse;
        };
        if (application && applicationData) {
          const convertedApplication = convertApplicationFromApi(application);

          dispatch(
            ApplicationActions.updateSuccess({
              appDetails: convertedApplication,
            }),
          );
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
        passAuthInfo
        passExplicitToken
      />
    </div>
  );
};
