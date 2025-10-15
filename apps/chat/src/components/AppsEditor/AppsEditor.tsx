import { useCallback, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import {
  getQuickAppDocumentUrl,
  isApplicationType,
} from '@/src/utils/app/application';
import { arraysHaveSameElements } from '@/src/utils/app/common';
import { getValidFormFields } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { CustomApplicationModel } from '@/src/types/applications';
import {
  MarketplaceEditorSteps,
  MarketplaceEntity,
} from '@/src/types/marketplace';

import { ApplicationActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import {
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { AppsEditorView } from '@/src/components/AppsEditor/AppsEditorView';
import {
  AppsEditorFormType,
  getApplicationPayload,
  getDefaultFormData,
  getValidationSchema,
} from '@/src/components/AppsEditor/form';

import { FeatureType } from '@epam/ai-dial-shared';
import { zodResolver } from '@hookform/resolvers/zod';

const marketplaceRoute = {
  pathname: Routes.Marketplace,
  query: {
    [MarketplaceQueryParams.tab]: MarketplaceTabs.MY_WORKSPACE,
    [MarketplaceQueryParams.entitiesTab]: MarketplaceEntitiesTabs.AGENTS,
  },
};

const checkShouldRevokeAccess = ({
  newApp,
  oldApp,
  isShared,
}: {
  newApp: CustomApplicationModel;
  oldApp?: CustomApplicationModel;
  isShared?: boolean;
}) => {
  const differentSourceFolders =
    !!oldApp &&
    newApp.function?.sourceFolder !== oldApp?.function?.sourceFolder;
  const differentDocumentUrl =
    !!oldApp &&
    !arraysHaveSameElements(
      getQuickAppDocumentUrl(newApp),
      getQuickAppDocumentUrl(oldApp),
    );

  return isShared && (differentSourceFolders || differentDocumentUrl);
};

export const AppsEditor = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const {
    [AppsEditorQuery.Schema]: typeQuery = '',
    [AppsEditorQuery.PublicationUrl]: publicationUrl = '',
  } = router.query;
  const type = decodeURIComponent(typeQuery.toString());

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const isSchemaApplicationType = !isApplicationType(type);

  const changeEditorTabRef = useRef<MarketplaceEditorSteps | null>(null);
  const saveAndExitRef = useRef<Routes.Chat | Routes.Marketplace | null>(null);
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const modelsWithFolder = useMemo(
    () => models.map((m) => ({ ...m, folderId: '' })),
    [models],
  );

  const formMethods = useForm<AppsEditorFormType>({
    defaultValues: getDefaultFormData({
      app: appDetails,
      models: modelsWithFolder,
      type: type,
      runtime: pythonVersions[0],
    }),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(getValidationSchema(type)),
  });
  const lastSubmittedValuesRef = useRef<AppsEditorFormType>(
    getDefaultFormData({
      app: appDetails,
      models: modelsWithFolder,
      type: type,
      runtime: pythonVersions[0],
    }),
  );
  const isDirty = formMethods.formState.isDirty;

  const marketplaceEntities = useMemo(
    () =>
      ({
        ...modelsMap,
        ...toolsetsMap,
      }) as Record<string, MarketplaceEntity>,
    [modelsMap, toolsetsMap],
  );
  const modelFromState = appDetails ? modelsMap[appDetails.reference] : null;
  const isShared = modelFromState?.isShared ?? false;

  const submitHandler = useCallback(
    (data: AppsEditorFormType) => {
      const payload = getApplicationPayload({
        data,
        allEntitiesMap: marketplaceEntities,
        currentApp: appDetails,
      });

      if (!appDetails) {
        dispatch(
          ApplicationActions.create({
            applicationData: {
              ...payload,
              ...(schema && {
                applicationTypeSchemaId: schema.$id,
              }),
            },
            schema: (isSchemaApplicationType && schema) || undefined,
          }),
        );
      } else {
        const shouldRevokeAccess = checkShouldRevokeAccess({
          newApp: payload,
          oldApp: appDetails,
          isShared,
        });
        if (shouldRevokeAccess) {
          dispatch(
            ShareActions.revokeAccess({
              resourceId: appDetails.id,
              featureType: FeatureType.Application,
            }),
          );
        }
        dispatch(
          ApplicationActions.update({
            oldApplication: appDetails,
            applicationData: {
              ...payload,
              ...(schema && {
                applicationTypeSchemaId: schema.$id,
              }),
              isShared: shouldRevokeAccess ? false : isShared,
            },
            schema: (isSchemaApplicationType && schema) || undefined,
            publicationUrl: publicationUrl
              ? decodeURIComponent(publicationUrl.toString())
              : undefined,
            tabToOpen: changeEditorTabRef.current ?? undefined,
            redirectUrl: saveAndExitRef.current ?? undefined,
          }),
        );
      }

      changeEditorTabRef.current = null;
      saveAndExitRef.current = null;
      formMethods.reset(formMethods.getValues(), {
        keepIsValid: true,
        keepErrors: true,
      });
      lastSubmittedValuesRef.current = getDefaultFormData(payload);
    },
    [
      appDetails,
      dispatch,
      formMethods,
      isSchemaApplicationType,
      isShared,
      marketplaceEntities,
      publicationUrl,
      schema,
    ],
  );

  const handleSubmit = useCallback(
    async (cb?: () => void, forceSave = false, skipValidation = false) => {
      const isValid = await (skipValidation
        ? Promise.resolve(true)
        : formMethods.trigger());

      if (!isValid && isDirty) {
        if (!forceSave) {
          changeEditorTabRef.current = null;
        } else {
          const data = formMethods.getValues();
          submitHandler({
            ...(lastSubmittedValuesRef.current as AppsEditorFormType),
            ...(getValidFormFields(
              data,
              formMethods.getFieldState,
            ) as AppsEditorFormType),
          });
        }
        return;
      }

      if (isDirty || !appDetails) {
        void formMethods
          .handleSubmit(submitHandler)()
          .then(() => cb?.());
      } else {
        changeEditorTabRef.current = null;
        saveAndExitRef.current = null;
        cb?.();
      }
    },
    [formMethods, isDirty, submitHandler, appDetails],
  );

  const handleSaveAndExit = useCallback(
    (saveDraft = false, redirectToChat = false) => {
      const chatUrl =
        (redirectToChat || !!router.query.publicationUrl) && Routes.Chat;

      if ((!isDirty && appDetails) || !appDetails || isAppPublic) {
        void router.push(chatUrl || marketplaceRoute);
        return;
      }

      saveAndExitRef.current = chatUrl || Routes.Marketplace;
      handleSubmit(undefined, saveDraft);
    },
    [isDirty, appDetails, isAppPublic, handleSubmit, router],
  );

  const handleTabClick = useCallback(
    (tab: MarketplaceEditorSteps) => {
      if (tab === editorStep) return;
      if (isAppPublic) {
        dispatch(ApplicationActions.setEditorStep(tab));
        return;
      }
      if (!isDirty && appDetails) {
        handleSubmit(
          () => dispatch(ApplicationActions.setEditorStep(tab)),
          true,
        );
      } else {
        changeEditorTabRef.current = tab;
        handleSubmit(undefined, true);
      }
    },
    [appDetails, dispatch, editorStep, handleSubmit, isAppPublic, isDirty],
  );

  const handleNextClick = useCallback(() => {
    if (isAppPublic) {
      dispatch(
        ApplicationActions.setEditorStep(MarketplaceEditorSteps.Settings),
      );
      return;
    }
    if (!isDirty && appDetails) {
      handleSubmit(() =>
        dispatch(
          ApplicationActions.setEditorStep(MarketplaceEditorSteps.Settings),
        ),
      );
    } else {
      changeEditorTabRef.current = MarketplaceEditorSteps.Settings;
      handleSubmit(undefined, !!appDetails);
    }
  }, [isAppPublic, isDirty, appDetails, dispatch, handleSubmit]);

  const handleAutoSave = useCallback(() => {
    if (editorStep === MarketplaceEditorSteps.General || isAppPublic) return;
    handleSubmit(undefined, true, true);
  }, [editorStep, handleSubmit, isAppPublic]);

  return (
    <FormProvider {...formMethods}>
      <div className="flex size-full flex-col">
        <AppsEditorHeader
          onTabClick={handleTabClick}
          onSave={handleSaveAndExit}
        />

        <AppsEditorView
          onNextClick={handleNextClick}
          onAutoSave={handleAutoSave}
        />
      </div>
    </FormProvider>
  );
};
