import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { EntityType } from '@/src/types/common';
import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { Routes } from '@/src/constants/routes';

import { ToolsetEditorHeader } from '@/src/components/ToolsetEditor/ToolsetEditorHeader';
import { ToolsetEditorView } from '@/src/components/ToolsetEditor/ToolsetEditorView';
import {
  ToolsetEditorForm,
  ToolsetEditorFormSchema,
  getDefaultFormData,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { zodResolver } from '@hookform/resolvers/zod';

export const ToolsetEditor = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const [editorStep, setEditorStep] = useState(
    toolsetDetails ? ToolsetEditorSteps.Settings : ToolsetEditorSteps.General,
  );

  const formMethods = useForm<ToolsetEditorForm>({
    defaultValues: getDefaultFormData(toolsetDetails, toolsets),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetEditorFormSchema),
  });

  const isDirty = formMethods.formState.isDirty;

  const submitHandler = useCallback(
    (data: ToolsetEditorForm) => {
      const payloadToolset = {
        id: '',
        folderId: '',
        reference: '',
        ...(toolsetDetails && toolsetDetails),
        type: EntityType.Toolset,
        name: data.name,
        endpoint: data.endpoint,
        iconUrl: data.iconUrl,
        transport: data.protocol,
        description: data.description,
        topics: data.topics,
        allowedTools: data.allowedTools,
        version: data.version,
        authSettings: {
          ...(toolsetDetails?.authSettings && toolsetDetails?.authSettings),
          ...(data.authenticationType === ToolsetAuthTypes.API_KEY && {
            apiKeyHeader:
              toolsetDetails?.authSettings?.apiKeyHeader ?? 'api_key',
          }),
          authenticationType: data.authenticationType,
        },
      };

      if (toolsetDetails) {
        dispatch(
          ToolsetActions.updateToolset({
            oldToolset: toolsetDetails,
            newToolset: payloadToolset,
          }),
        );
      } else {
        dispatch(
          ToolsetActions.createToolset({
            data: payloadToolset,
          }),
        );
      }
      formMethods.reset(getDefaultFormData(payloadToolset));
    },
    [dispatch, formMethods, toolsetDetails],
  );

  const handleSubmit = useCallback(
    (cb?: () => void) => {
      formMethods.trigger().then((isValid) => {
        if (!isValid) return;

        if (isDirty || !toolsetDetails) {
          void formMethods
            .handleSubmit(submitHandler)()
            .then(() => cb?.());
        } else {
          cb?.();
        }
      });
    },
    [formMethods, isDirty, toolsetDetails, submitHandler],
  );

  const handleSaveAndExit = useCallback(() => {
    if (!toolsetDetails) {
      void router.push(Routes.Marketplace);
      return;
    }
    handleSubmit(() => router.push(Routes.Marketplace));
  }, [handleSubmit, router, toolsetDetails]);

  const handleTabClick = useCallback(
    (tab: ToolsetEditorSteps) => {
      if (tab === editorStep) return;
      handleSubmit(() => setEditorStep(tab));
    },
    [editorStep, handleSubmit],
  );

  const handleNextClick = useCallback(() => {
    handleSubmit(() => setEditorStep(ToolsetEditorSteps.Settings));
  }, [handleSubmit]);

  return (
    <FormProvider {...formMethods}>
      <div className="flex size-full flex-col">
        <ToolsetEditorHeader
          currentStep={editorStep}
          onTabClick={handleTabClick}
          currentToolset={toolsetDetails}
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
