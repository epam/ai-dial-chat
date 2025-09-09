import { IconPencilMinus } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { PublicationActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { PublicationControls } from '@/src/components/Chat/Publish/PublicationControls/PublicationControls';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { IconButton } from '@/src/components/Common/IconButton';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { ApplicationTopic } from '@/src/components/Marketplace/ApplicationTopic';

function ReviewToolsetDialogContent() {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const toolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );

  const isResourceUnpublishing = useAppSelector((state) =>
    PublicationSelectors.selectIsResourceUnpublishing(
      state,
      selectedPublicationUrl ?? '',
      toolset?.id ?? '',
    ),
  );

  const controlsEntity = toolset
    ? {
        id: ApiUtils.decodeApiUrl(toolset.id),
        name: toolset.name,
        folderId: getFolderIdFromEntityId(toolset.id),
      }
    : null;

  const handleEditToolset = useCallback(() => {
    if (!toolset) return;

    dispatch(ToolsetActions.setToolsetDetails());
    void router.push({
      pathname: Routes.ToolsetEditor,
      query: {
        [ToolsetEditorQuery.Id]: toolset.reference,
        [ToolsetEditorQuery.Step]: ToolsetEditorSteps.Settings,
      },
    });
    dispatch(PublicationActions.setIsToolsetReview(false));
  }, [dispatch, router, toolset]);

  return (
    <>
      <div className="flex flex-col gap-2 overflow-auto px-3 py-4 text-sm md:p-6">
        <div className="flex justify-between">
          <h2 className="text-base font-semibold">{t('Application')}</h2>
        </div>
        <div className="flex gap-4">
          <span className="w-[135px] text-secondary">{t('Name: ')}</span>
          <span className="max-w-[414px] text-primary" data-qa="app-name">
            {toolset?.name}
          </span>
        </div>
        <div className="flex gap-4">
          <span className="w-[135px] text-secondary">{t('Version: ')}</span>
          <span className="max-w-[414px] text-primary" data-qa="app-version">
            {toolset?.version}
          </span>
        </div>
        <div className="flex gap-4">
          <span className="w-[135px] text-secondary">{t('Icon: ')}</span>
          {toolset && (
            <ModelIcon entity={toolset} entityId={toolset.id} size={60} />
          )}
        </div>
        {!!(toolset && getModelDescription(toolset)) && (
          <div className="flex gap-4">
            <span className="w-[135px] shrink-0 text-secondary">
              {t('Description: ')}
            </span>
            <span className="grow text-primary" data-qa="app-description">
              {getModelDescription(toolset)}
            </span>
          </div>
        )}
        {!!toolset?.topics?.length && (
          <div className="flex gap-4">
            <span className="w-[135px] text-secondary">{t('Topics: ')}</span>
            <div className="flex max-w-[414px] flex-wrap gap-1">
              {toolset.topics.map((topic) => (
                <ApplicationTopic key={topic} topic={topic} />
              ))}
            </div>
          </div>
        )}
        {toolset?.endpoint && (
          <div className="flex gap-4">
            <span className="w-[135px] text-secondary">{t('Endpoint: ')}</span>
            <span className="max-w-[414px] text-primary" data-qa="app-endpoint">
              {toolset.endpoint}
            </span>
          </div>
        )}
        {toolset?.transport && (
          <div className="flex gap-4">
            <span className="w-[135px] text-secondary">
              {t('Transport protocol: ')}
            </span>
            <span
              className="max-w-[414px] text-primary"
              data-qa="app-transport"
            >
              {toolset.transport}
            </span>
          </div>
        )}
        {toolset?.authSettings?.authenticationType && (
          <div className="flex gap-4">
            <span className="w-[135px] text-secondary">
              {t('Authentication type: ')}
            </span>
            <span
              className="max-w-[414px] text-primary"
              data-qa="app-authentication-type"
            >
              {toolset.authSettings.authenticationType}
            </span>
          </div>
        )}
        {!!toolset?.allowedTools?.length && (
          <div className="flex gap-4">
            <span className="w-[135px] text-secondary">
              {t('Allowed tools: ')}
            </span>
            <span
              className="max-w-[414px] text-primary"
              data-qa="app-allowed-tools"
            >
              {toolset.allowedTools.join(', ')}
            </span>
          </div>
        )}
      </div>
      <div
        className={classNames(
          'flex w-full items-center border-t border-tertiary px-3 py-4 md:px-5',
          isResourceUnpublishing ? 'justify-end' : 'justify-between',
        )}
      >
        {!isResourceUnpublishing && (
          <IconButton
            name={t('Edit toolset')}
            dataQa="admin-edit-toolset"
            Icon={IconPencilMinus}
            onClick={handleEditToolset}
          />
        )}

        {controlsEntity && (
          <PublicationControls
            entity={controlsEntity}
            controlsClassNames="text-sm"
          />
        )}
      </div>
    </>
  );
}

export const ReviewToolsetDialogView = withRenderWhen(
  ToolsetSelectors.selectToolsetDetails,
)(ReviewToolsetDialogContent);
