import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuick2AppDocumentUrl,
  getQuickAppDocumentUrl,
  isApplicationDeployed,
  isApplicationType,
} from '@/src/utils/app/application';
import { arraysHaveSameElements } from '@/src/utils/app/common';
import { getValidFormFields } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isTruthyQuery } from '@/src/utils/app/route';

import { CustomApplicationModel } from '@/src/types/applications';
import {
  MarketplaceEditorSteps,
  MarketplaceEntity,
} from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { Routes } from '@/src/constants/routes';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { AppsEditorView } from '@/src/components/AppsEditor/AppsEditorView';
import { EditorSelectedEntityModal } from '@/src/components/AppsEditor/EditorSelectedEntityModal';
import {
  AppsEditorFormType,
  QuickApp2Form,
  getApplicationPayload,
  getDefaultFormData,
  getValidationSchema,
} from '@/src/components/AppsEditor/form';

import { FeatureType } from '@epam/ai-dial-shared';
import { zodResolver } from '@hookform/resolvers/zod';

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
  const differentQuickApp2DocumentUrl =
    !!oldApp &&
    !arraysHaveSameElements(
      getQuick2AppDocumentUrl(newApp),
      getQuick2AppDocumentUrl(oldApp),
    );

  return (
    isShared &&
    (differentSourceFolders ||
      differentDocumentUrl ||
      differentQuickApp2DocumentUrl)
  );
};

export const AppsEditor = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { t } = useTranslation(Translation.Marketplace);

  const {
    [AppsEditorQuery.Schema]: typeQuery = '',
    [AppsEditorQuery.PublicationUrl]: publicationUrl = '',
    [AppsEditorQuery.IsCreating]: isCreating,
    [AppsEditorQuery.Id]: idQuery,
  } = router.query;
  const type = decodeURIComponent(typeQuery.toString());
  const isCreatingApp = !idQuery || isTruthyQuery(isCreating);

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const models = useAppSelector((state) =>
    ModelsSelectors.selectModels(state, true),
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const isSchemaApplicationType = !isApplicationType(type);
  const shouldTriggerEditorAutoUpdate = useAppSelector(
    ApplicationSelectors.selectShouldTriggerEditorAutoUpdate,
  );

  const changeEditorTabRef = useRef<MarketplaceEditorSteps | null>(null);
  const saveAndExitRef = useRef(false);
  const redirectToChatRef = useRef(false);
  const isSimpleViewSwitchRef = useRef(false);
  const firstValidationPerformedRef = useRef(false);

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const modelsWithFolder = useMemo(
    () => models.map((m) => ({ ...m, folderId: '' })),
    [models],
  );

  const toolSupportingModelIds = useAppSelector(
    ModelsSelectors.selectToolSupportingModelIds,
  );

  const defaultFormData = useMemo(
    () =>
      getDefaultFormData({
        app: appDetails,
        models: modelsWithFolder,
        type: type,
        runtime: pythonVersions[0],
        toolSupportingModelIds,
        schema: schema ?? undefined,
      }),
    [
      appDetails,
      modelsWithFolder,
      type,
      pythonVersions,
      toolSupportingModelIds,
      schema,
    ],
  );

  const formMethods = useForm<AppsEditorFormType>({
    defaultValues: defaultFormData,
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(getValidationSchema(type, schema ?? undefined)),
  });
  const lastSubmittedValuesRef = useRef<AppsEditorFormType>(defaultFormData);
  const isDirty = formMethods.formState.isDirty;
  const isQuickAppJsonDirty = (
    formMethods.formState.dirtyFields as Record<keyof QuickApp2Form, boolean>
  )['agentsAndToolsetsJson'];
  const onlyQuickAppJsonChanged =
    Object.keys(formMethods.formState.dirtyFields).length === 1 &&
    isQuickAppJsonDirty;

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
  const isAppDeployed = modelFromState && isApplicationDeployed(modelFromState);

  const submitHandler = useCallback(
    (data: AppsEditorFormType) => {
      const payload = getApplicationPayload({
        data,
        allEntitiesMap: marketplaceEntities,
        currentApp: appDetails,
        keepCurrentToolsets: !isSimpleViewSwitchRef.current,
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
              resourceIds: [appDetails.id],
              featureType: FeatureType.Application,
            }),
          );
        }
        if (isAppDeployed) {
          dispatch(
            UIActions.showWarningToast(
              t(MarketplaceI18nKeys.SavedChangesWillBeApplied),
            ),
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
            redirectUrl: redirectToChatRef.current ? Routes.Chat : undefined,
            isSaveAndExit: saveAndExitRef.current,
            shouldSelectApplication: isCreatingApp,
            shouldSetEditorError: isSimpleViewSwitchRef.current,
          }),
        );
      }

      const shouldKeepJsonFieldDirty =
        !isSimpleViewSwitchRef.current && isQuickAppJsonDirty;

      formMethods.reset(
        {
          ...formMethods.getValues(),
          ...(shouldKeepJsonFieldDirty && {
            agentsAndToolsetsJson: (
              lastSubmittedValuesRef.current as QuickApp2Form
            ).agentsAndToolsetsJson,
          }),
        },
        {
          keepIsValid: true,
          keepErrors: true,
        },
      );
      // Make agentsAndToolsetsJson dirty if it was not saved manually
      if (shouldKeepJsonFieldDirty) {
        formMethods.setValue(
          'agentsAndToolsetsJson',
          (data as QuickApp2Form).agentsAndToolsetsJson as string,
          { shouldDirty: true, shouldTouch: true, shouldValidate: true },
        );
      }

      lastSubmittedValuesRef.current = getDefaultFormData({
        app: payload,
        type,
        runtime: pythonVersions[0],
        toolSupportingModelIds,
        schema: schema ?? undefined,
      });
      isSimpleViewSwitchRef.current = false;
      changeEditorTabRef.current = null;
      saveAndExitRef.current = false;
      redirectToChatRef.current = false;
    },
    [
      marketplaceEntities,
      appDetails,
      isQuickAppJsonDirty,
      formMethods,
      type,
      pythonVersions,
      toolSupportingModelIds,
      dispatch,
      schema,
      isSchemaApplicationType,
      isShared,
      isAppDeployed,
      publicationUrl,
      isCreatingApp,
      t,
    ],
  );

  const handleSubmit = useCallback(
    async (
      cb?: () => void,
      forceSave = false,
      skipValidation = false,
      ignoreDirty = false,
    ) => {
      const isValid = await (skipValidation
        ? Promise.resolve(true)
        : formMethods.trigger());

      const isFormDirty = ignoreDirty || formMethods.formState.isDirty;

      if ((!isValid || skipValidation) && isFormDirty) {
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

      if (isFormDirty || !appDetails) {
        void formMethods
          .handleSubmit(submitHandler)()
          .then(() => cb?.());
      } else {
        changeEditorTabRef.current = null;
        saveAndExitRef.current = false;
        cb?.();
      }
    },
    [formMethods, submitHandler, appDetails],
  );

  const handleSaveAndExit = useCallback(
    (saveDraft = false, redirectToChat = false) => {
      if ((!isDirty && appDetails) || !appDetails || isAppPublic) {
        dispatch(
          ApplicationActions.exitEditor({
            redirectUrl: redirectToChat ? Routes.Chat : undefined,
            shouldSelectApplication: isCreatingApp,
          }),
        );
        return;
      }

      saveAndExitRef.current = true;
      redirectToChatRef.current = redirectToChat;
      dispatch(UIActions.setEditorLoader(true));

      void handleSubmit(undefined, saveDraft);
    },
    [isDirty, appDetails, isAppPublic, dispatch, handleSubmit, isCreatingApp],
  );

  const handleTabClick = useCallback(
    (tab: MarketplaceEditorSteps) => {
      if (tab === editorStep) return;
      if (isAppPublic) {
        dispatch(ApplicationActions.setEditorStep(tab));
        return;
      }
      if (!isDirty && appDetails) {
        void handleSubmit(
          () => dispatch(ApplicationActions.setEditorStep(tab)),
          true,
        );
      } else {
        changeEditorTabRef.current = tab;
        void handleSubmit(undefined, true);
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
      void handleSubmit(() =>
        dispatch(
          ApplicationActions.setEditorStep(MarketplaceEditorSteps.Settings),
        ),
      );
    } else {
      changeEditorTabRef.current = MarketplaceEditorSteps.Settings;
      void handleSubmit(undefined, !!appDetails);
    }
  }, [isAppPublic, isDirty, appDetails, dispatch, handleSubmit]);

  const handleAutoSave = useCallback(
    (isSimpleViewSwitch?: boolean, ignoreDirty?: boolean) => {
      if (editorStep === MarketplaceEditorSteps.General || isAppPublic) return;
      if (isSimpleViewSwitch) {
        isSimpleViewSwitchRef.current = true;
      } else if (onlyQuickAppJsonChanged) {
        return;
      }
      void handleSubmit(undefined, true, true, ignoreDirty);
    },
    [editorStep, handleSubmit, isAppPublic, onlyQuickAppJsonChanged],
  );

  useEffect(() => {
    if (shouldTriggerEditorAutoUpdate && !isAppPublic) {
      void handleSubmit(undefined, true, true);
      dispatch(ApplicationActions.setShouldTriggerEditorAutoUpdate(false));
    }
  }, [shouldTriggerEditorAutoUpdate, isAppPublic, handleSubmit, dispatch]);

  useEffect(() => {
    if (idQuery && !firstValidationPerformedRef.current && !isAppPublic) {
      void formMethods.trigger();
    }
    firstValidationPerformedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idQuery, formMethods.trigger, isAppPublic]);

  return (
    <>
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

      <EditorSelectedEntityModal />
    </>
  );
};
