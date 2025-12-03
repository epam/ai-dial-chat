import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isApplicationType } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';

import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EditorHeader } from '@/src/components/Header/EditorHeader';

import omit from 'lodash-es/omit';
import capitalize from 'lodash/capitalize';

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
      [AppsEditorQuery.IsCreating]: isCreating,
    },
  } = useRouter();

  // 1 stands for true
  const isCreatingApp =
    !id || (typeof isCreating === 'string' && isCreating === '1');

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
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const isExistingApp = !!appDetails;
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
        disabled: !isExistingApp,
      },
    ],
    [isExistingApp, t],
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

  const title = `${t(isCreatingApp ? 'Add' : 'Edit')} ${applicationTypeDisplayName}`;

  const handleTabClick = useCallback(
    (tab: { key: MarketplaceEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const handleLogoClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (isExistingApp) {
        const isValid = await trigger();

        if (!isValid) {
          setSaveDraftDialog(true);
          setRedirectToChat(true);
          return;
        }
      }
      onSave(false, true);
    },
    [isExistingApp, trigger, onSave],
  );

  const handleSaveAndRedirect = useCallback(async () => {
    if (isExistingApp) {
      const isValid = await trigger();

      if (!isValid) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isExistingApp, onSave, trigger]);

  const handleCloseConfirmDialog = useCallback(
    (result: boolean) => {
      setSaveDraftDialog(false);
      if (result && redirectToChat) {
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
    [dispatch, errorSteps, onSave, redirectToChat],
  );

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
    isExistingApp &&
    !hasCustomEditor &&
    (agent ? !isEntityIdPublic(agent) : false)
      ? 'Save and exit'
      : 'Exit';

  return (
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isExistingApp}
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
