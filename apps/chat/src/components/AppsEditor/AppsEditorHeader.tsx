import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isApplicationType } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
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
  ConversationsSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EditorHeader } from '@/src/components/Header/EditorHeader';

import { Feature } from '@epam/ai-dial-shared';
import { capitalize } from 'lodash';
import omit from 'lodash-es/omit';

const tabKeysInfo = {
  [MarketplaceEditorSteps.General]: {
    label: 'General info',
  },
  [MarketplaceEditorSteps.Settings]: {
    label: 'App settings',
  },
};

const applicationTypeNames = {
  [ApplicationType.CODE_APP]: 'Code app',
  [ApplicationType.CUSTOM_APP]: 'Custom app',
};

const anyRouteExceptAppEditorRegex = /^(?!\/apps-editor(?:\/|$)).*/;

const generalStepFields = ['name', 'version'];

interface AppsEditorHeaderProps {
  onTabClick: (tab: MarketplaceEditorSteps) => void;
  onSave: (saveDraft?: boolean, redirectToChat?: boolean) => void;
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

  const { formState, trigger } = useFormContext<AppsEditorFormType>();
  const errors = formState.errors;
  const isValid = formState.isValid;

  const [saveDraftDialog, setSaveDraftDialog] = useState(false);
  const [redirectToChat, setRedirectToChat] = useState(false);

  const currentStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isNewConversationDisabled = enabledFeatures.has(
    Feature.HideNewConversation,
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
    : applicationTypeNames[
        decodeURIComponent(schemaId.toString()) as ApplicationType
      ];
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

  const errorSteps = useMemo(() => {
    const steps = new Set<MarketplaceEditorSteps>();
    const errorKeys = Object.keys(errors);

    if (generalStepFields.some((f) => errorKeys.includes(f)) && !isValid) {
      steps.add(MarketplaceEditorSteps.General);
    }
    if (Object.keys(omit(errors, generalStepFields)).length > 0 && !isValid) {
      steps.add(MarketplaceEditorSteps.Settings);
    }

    return steps;
  }, [errors, isValid]);

  const title = `${t(isEditing ? 'Edit' : 'Add')} ${applicationTypeDisplayName}`;

  const handleTabClick = useCallback(
    (tab: { key: MarketplaceEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const createNewConversation = useCallback(() => {
    if (!areConversationsLoaded || isNewConversationDisabled) return;
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME],
      }),
    );
    dispatch(ConversationsActions.resetSearch());
  }, [areConversationsLoaded, dispatch, isNewConversationDisabled]);

  const handleLogoClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (isEditing) {
        const isValid = await trigger();

        if (!isValid) {
          setSaveDraftDialog(true);
          setRedirectToChat(true);
          return;
        }
      }
      createNewConversation();
      onSave(false, true);
    },
    [createNewConversation, isEditing, trigger, onSave],
  );

  const handleSaveAndRedirect = useCallback(async () => {
    if (isEditing) {
      const isValid = await trigger();

      if (!isValid) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isEditing, onSave, trigger]);

  const handleCloseConfirmDialog = useCallback(
    (result: boolean) => {
      setSaveDraftDialog(false);
      if (result && redirectToChat) {
        createNewConversation();
        onSave(true, true);
        return;
      } else if (result) {
        onSave(true);
        return;
      }
      setRedirectToChat(false);
      const invalidStep = Array.from(errorSteps)[0];

      if (invalidStep) {
        dispatch(ApplicationActions.setEditorStep(invalidStep));
      }
    },
    [createNewConversation, dispatch, errorSteps, onSave, redirectToChat],
  );

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
      let labelText = tabKeysInfo[tabKey].label.toLowerCase();
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
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isEditing}
        onTabClick={handleTabClick}
        getMobileTabLabel={getMobileLabelText}
        title={title}
        saveLabel={saveLabel}
        onSave={handleSaveAndRedirect}
        onLogoClick={handleLogoClick}
        dataQa="entity-editor-header"
      />

      <ConfirmDialog
        isOpen={saveDraftDialog}
        heading={t('Only valid data will be saved')}
        description={t(
          'Some fields are invalid or required fields are missing.\nChanges in those fields will not be saved.\nExit and save only valid information?',
        )}
        confirmLabel={t('Save valid data')}
        cancelLabel={t('Continue editing')}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
