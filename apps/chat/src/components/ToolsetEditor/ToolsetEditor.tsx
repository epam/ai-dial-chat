import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';

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
    defaultValues: getDefaultFormData(
      toolsetDetails,
      toolsets as ToolsetModel[],
    ),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetEditorFormSchema),
  });

  const submitHandler = useCallback(
    (data: ToolsetEditorForm) => {
      if (!formMethods.formState.isDirty) return;

      if (toolsetDetails) {
        dispatch(
          ToolsetActions.updateToolset({
            oldToolset: toolsetDetails,
            newToolset: {
              ...toolsetDetails,
              name: data.name,
              endpoint: data.endpoint,
              iconUrl: data.iconUrl,
              transport: data.protocol,
              description: data.description,
              topics: data.topics,
              allowedTools: data.allowedTools,
              version: data.version,
            },
          }),
        );
      } else {
        dispatch(
          ToolsetActions.createToolset({
            data: {
              name: data.name,
              folderId: '',
              endpoint: data.endpoint,
              iconUrl: data.iconUrl,
              transport: data.protocol,
              allowedTools: data.allowedTools,
              topics: data.topics,
              version: data.version,
              description: data.description,
            },
          }),
        );
      }
    },
    [dispatch, formMethods.formState.isDirty, toolsetDetails],
  );

  const handleSubmit = useCallback(
    (cb?: () => void) =>
      formMethods
        .handleSubmit(submitHandler)()
        .then(() => cb?.()),
    [formMethods, submitHandler],
  );

  const handleSaveAndExit = useCallback(() => {
    if (!formMethods.formState.isDirty) return router.push(Routes.Marketplace);
    void handleSubmit(() => router.push(Routes.Marketplace));
  }, [formMethods, handleSubmit, router]);

  const handleTabClick = useCallback(
    (tab: ToolsetEditorSteps) => {
      if (!formMethods.formState.isDirty) return setEditorStep(tab);
      void handleSubmit(() => setEditorStep(tab));
    },
    [formMethods, handleSubmit],
  );

  const handleNextClick = useCallback(() => {
    if (!formMethods.formState.isDirty)
      return setEditorStep(ToolsetEditorSteps.Settings);
    void handleSubmit(() => setEditorStep(ToolsetEditorSteps.Settings));
  }, [formMethods, handleSubmit]);

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
