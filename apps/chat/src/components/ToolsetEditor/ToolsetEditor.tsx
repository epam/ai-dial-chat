import { useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { getValidFormFields } from '@/src/utils/app/forms';
import { getToolsetPayload } from '@/src/utils/app/toolsets';

import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

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

export const ToolsetEditor = () => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const {
    [ToolsetEditorQuery.Id]: idQuery,
    [ToolsetEditorQuery.IsCreate]: isCreateQuery,
  } = router.query;
  const isCreateRef = useRef(!idQuery || !!isCreateQuery);
  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const editorStep = useAppSelector(ToolsetSelectors.selectEditorStep);

  const changeEditorTabRef = useRef<ToolsetEditorSteps | null>(null);
  const saveAndExitRef = useRef(false);
  const redirectToChatRef = useRef(false);

  const [isExiting, setIsExiting] = useState(false);

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
          endpoint: data.endpoint.trim(),
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
            redirectUrl: redirectToChatRef.current ? Routes.Chat : undefined,
            exitAfterSave: saveAndExitRef.current,
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
      saveAndExitRef.current = false;
      redirectToChatRef.current = false;
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
      if ((!isDirty && toolsetDetails) || !toolsetDetails) {
        dispatch(
          ToolsetActions.exitEditor({
            redirectUrl: redirectToChat ? Routes.Chat : undefined,
            shouldSelectToolset: isCreateRef.current,
          }),
        );
        return;
      }

      saveAndExitRef.current = true;
      redirectToChatRef.current = redirectToChat;
      handleSubmit(undefined, saveDraft);
    },
    [dispatch, handleSubmit, isDirty, toolsetDetails],
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
          disableLoader={isExiting}
        />
      </div>
    </FormProvider>
  );
};
