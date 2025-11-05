import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EditorHeader } from '@/src/components/Header/EditorHeader';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

import { Feature } from '@epam/ai-dial-shared';

const stepFields: {
  step: ToolsetEditorSteps;
  fields: (keyof ToolsetEditorForm)[];
}[] = [
  { step: ToolsetEditorSteps.General, fields: ['name', 'version'] },
  {
    step: ToolsetEditorSteps.Settings,
    fields: ['endpoint', 'clientId', 'clientSecret'],
  },
];

interface ToolsetEditorHeaderProps {
  onTabClick: (tab: ToolsetEditorSteps) => void;
  onSave: (saveDraft?: boolean, redirectToChat?: boolean) => void;
}

export const ToolsetEditorHeader = ({
  onTabClick,
  onSave,
}: ToolsetEditorHeaderProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const currentStep = useAppSelector(ToolsetSelectors.selectEditorStep);
  const currentToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isNewConversationDisabled = enabledFeatures.has(
    Feature.HideNewConversation,
  );

  const isEditing = !!currentToolset;

  const [saveDraftDialog, setSaveDraftDialog] = useState(false);
  const [redirectToChat, setRedirectToChat] = useState(false);

  const { formState, trigger } = useFormContext<ToolsetEditorForm>();
  const errors = formState.errors;
  const isValid = formState.isValid;

  const errorSteps = useMemo(() => {
    return stepFields.reduce<Set<ToolsetEditorSteps>>(
      (steps, { step, fields }) => {
        if (!isValid && fields.some((field) => errors[field])) {
          steps.add(step);
        }
        return steps;
      },
      new Set(),
    );
  }, [errors, isValid]);

  const tabs = useMemo(
    () => [
      {
        label: ToolsetEditorSteps.General,
        key: ToolsetEditorSteps.General,
        disabled: false,
      },
      {
        label: ToolsetEditorSteps.Settings,
        key: ToolsetEditorSteps.Settings,
        disabled: !isEditing,
      },
    ],
    [isEditing],
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
    [createNewConversation, isEditing, onSave, trigger],
  );

  const handleTabClick = useCallback(
    (tab: { key: ToolsetEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const handleSaveClick = useCallback(async () => {
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
        dispatch(ToolsetActions.setEditorStep(invalidStep));
      }
    },
    [createNewConversation, dispatch, errorSteps, onSave, redirectToChat],
  );

  return (
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isEditing}
        onTabClick={handleTabClick}
        title={t(isEditing ? 'Edit toolset' : 'Add toolset')}
        saveLabel={isEditing ? 'Save and exit' : 'Exit'}
        onSave={handleSaveClick}
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
