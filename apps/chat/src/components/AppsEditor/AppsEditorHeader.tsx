import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';
import { useEditorSaveLabel } from '@/src/hooks/useEditorSaveLabel';

import { isApplicationType } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isTruthyQuery } from '@/src/utils/app/route';

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
import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EditorHeader } from '@/src/components/Header/EditorHeader';

import omit from 'lodash-es/omit';
import capitalize from 'lodash/capitalize';

const tabKeysInfo = {
  [MarketplaceEditorSteps.General]: {
    label: MarketplaceI18nKeys.GeneralInfo,
  },
  [MarketplaceEditorSteps.Settings]: {
    label: MarketplaceI18nKeys.AppSettings,
  },
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
  const router = useRouter();
  const {
    query: {
      [AppsEditorQuery.Id]: id = '',
      [AppsEditorQuery.Schema]: schemaId = '',
      [AppsEditorQuery.IsCreating]: isCreating,
    },
  } = router;

  // 1 stands for true
  const isCreatingApp = !id || isTruthyQuery(isCreating);

  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const { control, trigger } = useFormContext<AppsEditorFormType>();
  const { errors, isValid } = useFormState<AppsEditorFormType>({ control });
  const isAppLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );

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
    : t(
        decodeURIComponent(schemaId.toString()) === ApplicationType.CODE_APP
          ? MarketplaceI18nKeys.CodeApp
          : MarketplaceI18nKeys.CustomApp,
      );
  const hasCustomEditor =
    !!schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl];

  const agent = id ? modelsMap[id.toString()] : undefined;
  const isPublicApp = agent && isEntityIdPublic(agent);

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

  const title = `${t(isCreatingApp ? MarketplaceI18nKeys.AddMarketplace : MarketplaceI18nKeys.EditMarketplace)} ${applicationTypeDisplayName}`;

  const handleTabClick = useCallback(
    (tab: { key: MarketplaceEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  useEffect(() => {
    if (isPublicApp && !isAppLoading) {
      const timerId = setTimeout(() => {
        trigger();
      });
      return () => clearTimeout(timerId);
    }
  }, [dispatch, isPublicApp, isAppLoading, trigger]);

  const handleLogoClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (isExistingApp) {
        const isValid = await trigger();

        if (!isValid && !isPublicApp) {
          setSaveDraftDialog(true);
          setRedirectToChat(true);
          return;
        }
      }
      onSave(false, true);
    },
    [isExistingApp, onSave, trigger, isPublicApp],
  );

  const handleSaveAndRedirect = useCallback(async () => {
    if (isExistingApp) {
      const isValid = await trigger();

      if (!isValid && !isPublicApp) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isExistingApp, isPublicApp, onSave, trigger]);

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

  const saveLabel = useEditorSaveLabel(
    isExistingApp && !hasCustomEditor && !isPublicApp,
  );

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
        heading={t(MarketplaceI18nKeys.OnlyValidDataWillBeSaved)}
        description={t(MarketplaceI18nKeys.SomeFieldsAreInvalid)}
        confirmLabel={t(MarketplaceI18nKeys.SaveValidData)}
        cancelLabel={t(MarketplaceI18nKeys.ContinueEditing)}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
