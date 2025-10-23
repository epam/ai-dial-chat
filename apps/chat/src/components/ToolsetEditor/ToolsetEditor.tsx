import { useCallback, useEffect, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { getValidFormFields } from '@/src/utils/app/forms';
import { getToolsetPayload } from '@/src/utils/app/toolsets';

import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import {
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ToolsetEditorHeader } from '@/src/components/ToolsetEditor/ToolsetEditorHeader';
import { ToolsetEditorView } from '@/src/components/ToolsetEditor/ToolsetEditorView';
import {
  ToolsetEditorForm,
  ToolsetEditorFormSchema,
  getDefaultFormData,
} from '@/src/components/ToolsetEditor/form';

import { zodResolver } from '@hookform/resolvers/zod';

const marketplaceRoute = {
  pathname: Routes.Marketplace,
  query: {
    [MarketplaceQueryParams.tab]: MarketplaceTabs.MY_WORKSPACE,
    [MarketplaceQueryParams.entitiesTab]: MarketplaceEntitiesTabs.TOOLSETS,
  },
};

export const ToolsetEditor = () => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const { [ToolsetEditorQuery.Id]: idQuery } = router.query;
  const isCreateRef = useRef(!idQuery);

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const editorStep = useAppSelector(ToolsetSelectors.selectEditorStep);

  const changeEditorTabRef = useRef<ToolsetEditorSteps | null>(null);
  const saveAndExitRef = useRef<Routes.Chat | Routes.Marketplace | null>(null);

  const formMethods = useForm<ToolsetEditorForm>({
    defaultValues: getDefaultFormData(toolsetDetails, toolsets),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetEditorFormSchema),
  });
  const lastSubmittedValuesRef = useRef<ToolsetEditorForm>(
    getDefaultFormData(toolsetDetails, toolsets),
  );

  const isDirty = formMethods.formState.isDirty;

  const submitHandler = useCallback(
    (data: ToolsetEditorForm) => {
      const payloadToolset = getToolsetPayload(
        {
          name: data.name,
          endpoint: data.endpoint,
          iconUrl: data.iconUrl,
          transport: data.protocol,
          description: data.description,
          topics: data.topics,
          allowedTools: data.allowedTools,
          version: data.version,
          authSettings: {
            authenticationType: data.authenticationType,
            apiKeyHeader: data.keyHeader,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            authorizationEndpoint: data.authorizationEndpoint,
            tokenEndpoint: data.tokenEndpoint,
          },
        },
        toolsetDetails,
      );

      if (toolsetDetails) {
        dispatch(
          ToolsetActions.updateToolset({
            oldToolset: toolsetDetails,
            newToolset: payloadToolset,
            tabToOpen: changeEditorTabRef.current ?? undefined,
            redirectUrl: saveAndExitRef.current ?? undefined,
            shouldSelectToolset: isCreateRef.current,
          }),
        );
      } else {
        dispatch(
          ToolsetActions.createToolset({
            data: payloadToolset,
          }),
        );
      }

      changeEditorTabRef.current = null;
      saveAndExitRef.current = null;
      formMethods.reset(formMethods.getValues(), {
        keepIsValid: true,
        keepErrors: true,
      });
      lastSubmittedValuesRef.current = getDefaultFormData(payloadToolset);
    },
    [dispatch, formMethods, toolsetDetails],
  );

  const handleSubmit = useCallback(
    (cb?: () => void, forceSave = false) => {
      formMethods.trigger().then((isValid) => {
        if (!isValid && isDirty) {
          if (!forceSave) {
            changeEditorTabRef.current = null;
          } else {
            const data = formMethods.getValues();
            submitHandler({
              ...lastSubmittedValuesRef.current,
              ...getValidFormFields(data, formMethods.getFieldState),
            });
          }
          return;
        }

        if (isDirty || !toolsetDetails) {
          void formMethods
            .handleSubmit(submitHandler)()
            .then(() => cb?.());
        } else {
          changeEditorTabRef.current = null;
          saveAndExitRef.current = null;
          cb?.();
        }
      });
    },
    [formMethods, isDirty, submitHandler, toolsetDetails],
  );

  const handleSaveAndExit = useCallback(
    (saveDraft = false, redirectToChat = false) => {
      const chatUrl =
        (redirectToChat || !!router.query.publicationUrl) && Routes.Chat;

      if ((!isDirty && toolsetDetails) || !toolsetDetails) {
        void router.push(chatUrl || marketplaceRoute);
        dispatch(
          MarketplaceActions.setDetailsEntity(
            isCreateRef.current && toolsetDetails?.reference
              ? {
                  reference: toolsetDetails?.reference,
                  type: MarketplaceEntitiesTabs.TOOLSETS,
                  isSuggested: false,
                }
              : undefined,
          ),
        );
        return;
      }

      saveAndExitRef.current = chatUrl || Routes.Marketplace;
      handleSubmit(undefined, saveDraft);
    },
    [dispatch, handleSubmit, isDirty, router, toolsetDetails],
  );

  const handleTabClick = useCallback(
    (tab: ToolsetEditorSteps) => {
      if (tab === editorStep) return;
      if (!isDirty && toolsetDetails) {
        handleSubmit(() => dispatch(ToolsetActions.setEditorStep(tab)), true);
      } else {
        changeEditorTabRef.current = tab;
        handleSubmit(undefined, true);
      }
    },
    [dispatch, editorStep, handleSubmit, isDirty, toolsetDetails],
  );

  const handleNextClick = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isDirty && toolsetDetails) {
        handleSubmit(() =>
          dispatch(ToolsetActions.setEditorStep(ToolsetEditorSteps.Settings)),
        );
      } else {
        changeEditorTabRef.current = ToolsetEditorSteps.Settings;
        handleSubmit(undefined, !!toolsetDetails);
      }
    },
    [dispatch, handleSubmit, isDirty, toolsetDetails],
  );

  useEffect(() => {
    if (toolsetDetails) {
      formMethods.resetField('authenticationType', {
        defaultValue: toolsetDetails.authSettings.authenticationType,
        keepDirty: false,
      });
    }
  }, [formMethods, toolsetDetails]);

  return (
    <FormProvider {...formMethods}>
      <div className="flex size-full flex-col">
        <ToolsetEditorHeader
          onTabClick={handleTabClick}
          onSave={handleSaveAndExit}
        />

        <ToolsetEditorView
          currentStep={editorStep}
          onNextClick={handleNextClick}
          currentToolset={toolsetDetails}
        />
      </div>
    </FormProvider>
  );
};
