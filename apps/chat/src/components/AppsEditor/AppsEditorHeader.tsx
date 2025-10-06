import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isApplicationType } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ConversationsActions,
  PublicationActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { EditorHeader } from '@/src/components/Header/EditorHeader';

import { capitalize } from 'lodash';

const tabKeysInfo = {
  [MarketplaceEditorSteps.General]: {
    label: 'General info',
  },
  [MarketplaceEditorSteps.Settings]: {
    label: 'App settings',
  },
};

const anyRouteExceptAppEditorRegex = /^(?!\/apps-editor(?:\/|$)).*/;

interface AppsEditorHeaderProps {
  onTabClick: (tab: MarketplaceEditorSteps) => void;
  onSave: (saveDraft?: boolean) => void;
}

export const AppsEditorHeader = ({
  onTabClick,
  onSave,
}: AppsEditorHeaderProps) => {
  const {
    query: {
      [AppsEditorQuery.Id]: id = '',
      [AppsEditorQuery.Schema]: schemaId = '',
      [AppsEditorQuery.PublicationUrl]: publicationUrl,
    },
  } = useRouter();
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const currentStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const isEditing = !!appDetails;

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const returnConversationIds = useAppSelector(
    ApplicationSelectors.selectReturnConversationIds,
  );

  const isSchemaApplicationType = !isApplicationType(
    decodeURIComponent(schemaId.toString()),
  );
  const applicationTypeDisplayName = isSchemaApplicationType
    ? (schema?.[ApplicationTypeSchemaProperties.applicationTypeDisplayName] ??
      '')
    : decodeURIComponent(schemaId.toString());
  const hasCustomEditor =
    !!schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl];

  const agent = id ? modelsMap[id.toString()] : undefined;

  const tabs = useMemo(
    () => [
      {
        key: MarketplaceEditorSteps.General,
        label: t(tabKeysInfo[MarketplaceEditorSteps.General].label),
        disabled: false,
      },
      {
        key: MarketplaceEditorSteps.Settings,
        label: t(tabKeysInfo[MarketplaceEditorSteps.Settings].label),
        disabled: !isEditing,
      },
    ],
    [isEditing, t],
  );

  const title = `${t(isEditing ? 'Edit' : 'Add')} ${applicationTypeDisplayName}`;

  const handleTabClick = useCallback(
    (tab: { key: MarketplaceEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const handleSaveAndRedirect = useCallback(() => {
    // TODO: implement save draft
    onSave();
  }, [onSave]);

  const handleCustomViewerExit = useCallback(() => {
    if (hasCustomEditor) {
      dispatch(
        ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
      );

      if (publicationUrl) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [],
          }),
        );
        dispatch(PublicationActions.setIsApplicationReview(true));
      } else if (returnConversationIds?.length) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: returnConversationIds,
          }),
        );
        dispatch(ApplicationActions.setReturnConversationIds(undefined));
      } else {
        dispatch(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
      }
    }
  }, [dispatch, hasCustomEditor, publicationUrl, returnConversationIds]);

  const getMobileLabelText = useCallback(
    (tabKey: MarketplaceEditorSteps) => {
      const capitalizedAppType = capitalize(applicationTypeDisplayName);
      let labelText = tabKeysInfo[tabKey].label.toUpperCase();
      if (tabKey === MarketplaceEditorSteps.Settings) {
        labelText = labelText.replace(/^app\s+/i, '');
      }

      return `${capitalizedAppType} ${labelText}`;
    },
    [applicationTypeDisplayName],
  );

  const saveLabel =
    isEditing && !hasCustomEditor && (agent ? !isEntityIdPublic(agent) : false)
      ? 'Save and exit'
      : 'Exit';

  useBeforeRedirect(handleCustomViewerExit, anyRouteExceptAppEditorRegex);

  return (
    <EditorHeader
      tabs={tabs}
      activeTab={currentStep}
      isEditing={isEditing}
      onTabClick={handleTabClick}
      getMobileTabLabel={getMobileLabelText}
      title={title}
      saveLabel={saveLabel}
      onSave={handleSaveAndRedirect}
      dataQa="app-editor-header"
    />
  );
};
