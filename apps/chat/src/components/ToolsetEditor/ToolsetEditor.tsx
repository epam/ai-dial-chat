import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { getValidFormFields } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isTruthyQuery } from '@/src/utils/app/route';
import { getToolsetPayload, isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ToolsetEditorHeader } from '@/src/components/ToolsetEditor/ToolsetEditorHeader';
import { ToolsetEditorView } from '@/src/components/ToolsetEditor/ToolsetEditorView';
import {
  ENDPOINT_PLACEHOLDER,
  ToolsetEditorForm,
  ToolsetEditorFormSchema,
  getDefaultFormData,
} from '@/src/components/ToolsetEditor/form';

import { zodResolver } from '@hookform/resolvers/zod';

export const ToolsetEditor = () => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const {
    [ToolsetEditorQuery.Id]: idQuery,
    [ToolsetEditorQuery.IsCreating]: isCreating,
  } = router.query;
  const isCreatingToolset = !idQuery || isTruthyQuery(isCreating);

  const locale = useAppSelector(UISelectors.selectLocale);
  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const editorStep = useAppSelector(ToolsetSelectors.selectEditorStep);

  const changeEditorTabRef = useRef<ToolsetEditorSteps | null>(null);
  const saveAndExitRef = useRef(false);
  const redirectToChatRef = useRef(false);
  const firstValidationPerformedRef = useRef(false);

  const isAdminReview = toolsetDetails && isEntityIdPublic(toolsetDetails);

  const [isExiting, setIsExiting] = useState(false);

  const formMethods = useForm<ToolsetEditorForm>({
    defaultValues: getDefaultFormData({
      toolset: toolsetDetails,
      toolsets,
      isAdminReview,
      locale,
    }),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetEditorFormSchema),
  });
  const lastSubmittedValuesRef = useRef<ToolsetEditorForm>(
    getDefaultFormData({ toolset: toolsetDetails, toolsets, locale }),
  );

  const isDirty = formMethods.formState.isDirty;
  const isToolsetPublic = !!toolsetDetails && isEntityIdPublic(toolsetDetails);

  const submitHandler = useCallback(
    (data: ToolsetEditorForm) => {
      const payloadToolset = getToolsetPayload(
        {
          name: data.name,
          endpoint:
            data.endpoint === ENDPOINT_PLACEHOLDER ? '' : data.endpoint.trim(),
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
            tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
            scopesSupported: data.scopes,
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
            redirectUrl: redirectToChatRef.current ? Routes.Chat : undefined,
            exitAfterSave: saveAndExitRef.current,
            shouldSelectToolset: isCreatingToolset,
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
      saveAndExitRef.current = false;
      redirectToChatRef.current = false;
      formMethods.reset(formMethods.getValues(), {
        keepIsValid: true,
        keepErrors: true,
      });
      lastSubmittedValuesRef.current = getDefaultFormData({
        toolset: payloadToolset,
        locale,
      });
    },
    [dispatch, formMethods, isCreatingToolset, toolsetDetails, locale],
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
          saveAndExitRef.current = false;
          cb?.();
        }
      });
    },
    [formMethods, isDirty, submitHandler, toolsetDetails],
  );

  const handleSaveAndExit = useCallback(
    (saveDraft = false, redirectToChat = false) => {
      setIsExiting(true);
      if ((!isDirty && toolsetDetails) || !toolsetDetails || isToolsetPublic) {
        dispatch(
          ToolsetActions.exitEditor({
            redirectUrl: redirectToChat ? Routes.Chat : undefined,
            shouldSelectToolset: isCreatingToolset,
          }),
        );
        return;
      }

      saveAndExitRef.current = true;
      redirectToChatRef.current = redirectToChat;
      dispatch(UIActions.setEditorLoader(true));
      handleSubmit(undefined, saveDraft);
    },
    [
      dispatch,
      handleSubmit,
      isCreatingToolset,
      isDirty,
      isToolsetPublic,
      toolsetDetails,
    ],
  );

  const handleTabClick = useCallback(
    (tab: ToolsetEditorSteps) => {
      if (tab === editorStep) return;
      if (isToolsetPublic) {
        dispatch(ToolsetActions.setEditorStep(tab));
        return;
      }
      if (!isDirty && toolsetDetails) {
        handleSubmit(() => dispatch(ToolsetActions.setEditorStep(tab)), true);
      } else {
        changeEditorTabRef.current = tab;
        handleSubmit(undefined, true);
      }
    },
    [
      dispatch,
      editorStep,
      handleSubmit,
      isDirty,
      isToolsetPublic,
      toolsetDetails,
    ],
  );

  const handleNextClick = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isToolsetPublic) {
        dispatch(ToolsetActions.setEditorStep(ToolsetEditorSteps.Settings));
        return;
      }
      if (!isDirty && toolsetDetails) {
        handleSubmit(() =>
          dispatch(ToolsetActions.setEditorStep(ToolsetEditorSteps.Settings)),
        );
      } else {
        changeEditorTabRef.current = ToolsetEditorSteps.Settings;
        handleSubmit(undefined, !!toolsetDetails);
      }
    },
    [dispatch, handleSubmit, isDirty, isToolsetPublic, toolsetDetails],
  );

  useEffect(() => {
    if (toolsetDetails) {
      formMethods.resetField('authenticationType', {
        defaultValue: toolsetDetails.authSettings.authenticationType,
        keepDirty: false,
      });
      formMethods.setValue('isLoggedIn', isToolsetSignedIn(toolsetDetails), {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [formMethods, toolsetDetails]);

  useEffect(() => {
    if (idQuery && !firstValidationPerformedRef.current && !isToolsetPublic) {
      void formMethods.trigger();
    }
    firstValidationPerformedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idQuery, formMethods.trigger, isToolsetPublic]);

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
          disableLoader={isExiting}
        />
      </div>
    </FormProvider>
  );
};
