import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';

import { FC, ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';

import { useAgentSkillsValidation } from '@/src/hooks/useAgentSkillsValidation';

import { QuickApp2Schema } from '@/src/components/AppsEditor/form';

import { zodResolver } from '@hookform/resolvers/zod';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    skillValidationMap: {} as Record<string, { status: string }>,
    appId: 'applications/bucket/app' as string | undefined,
  },
}));

vi.mock('@/src/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector(undefined),
}));

vi.mock('@/src/store/selectors', () => ({
  PromptsSelectors: {
    selectSkillValidationMap: () => mocks.state.skillValidationMap,
  },
  ApplicationSelectors: {
    selectApplicationDetail: () => ({ id: mocks.state.appId }),
  },
}));

vi.mock('@/src/store/actions', () => ({
  PromptsActions: {
    uploadPrompt: (payload: { promptId: string }) => ({
      type: 'prompts/uploadPrompt',
      payload,
    }),
  },
}));

const SKILL_ID = 'prompts/bucket/Skill_1';

const buildDefaults = (agentSkills: string[]) => ({
  type: 'Quick app2',
  instructions: '',
  temperature: 0.5,
  documentRelativeUrl: [],
  model: 'gpt-4',
  agentsAndToolsets: [],
  codeInterpreter: false,
  inputAttachmentTypes: [],
  pendingInputAttachmentType: '',
  isJsonView: false,
  agentsAndToolsetsJson: '[]',
  chatMessageInputDisabled: false,
  autoSubmit: false,
  starters: [],
  agentSkills,
  invalidAgentSkills: [],
  timestamp: false,
  fileTools: false,
  processLargeFiles: false,
  addAttachment: false,
  webFetch: false,
});

const renderWithForm = (agentSkills: string[]) => {
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => {
    const methods = useForm({
      defaultValues: buildDefaults(agentSkills) as never,
      mode: 'onChange',
      resolver: zodResolver(QuickApp2Schema),
    });

    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  return renderHook(
    () => {
      useAgentSkillsValidation();
      return useFormContext();
    },
    { wrapper },
  );
};

describe('useAgentSkillsValidation', () => {
  beforeEach(() => {
    mocks.dispatch.mockClear();
    mocks.state.skillValidationMap = {};
    mocks.state.appId = 'applications/bucket/app';
  });

  it('uploads each selected skill so that it gets validated', async () => {
    renderWithForm([SKILL_ID]);

    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({
        type: 'prompts/uploadPrompt',
        payload: { promptId: SKILL_ID },
      }),
    );
  });

  it('does not upload skills while the application does not exist yet', async () => {
    mocks.state.appId = undefined;

    renderWithForm([SKILL_ID]);

    await act(async () => undefined);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('does not re-upload a skill that already has a validation result', async () => {
    mocks.state.skillValidationMap = { [SKILL_ID]: { status: 'invalid' } };

    renderWithForm([SKILL_ID]);

    await act(async () => undefined);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('mirrors invalid skills into the form and makes it invalid', async () => {
    mocks.state.skillValidationMap = { [SKILL_ID]: { status: 'invalid' } };

    const { result } = renderWithForm([SKILL_ID]);

    // no explicit trigger() here: the hook has to surface the error on its own,
    // which is what puts the "App settings" tab into the error state
    await waitFor(() => {
      expect(result.current.getValues('invalidAgentSkills')).toEqual([
        SKILL_ID,
      ]);
      expect(result.current.formState.errors.agentSkills).toBeDefined();
      expect(result.current.formState.isValid).toBe(false);
    });
  });

  it('leaves the form valid when every skill is valid', async () => {
    mocks.state.skillValidationMap = { [SKILL_ID]: { status: 'valid' } };

    const { result } = renderWithForm([SKILL_ID]);

    await act(async () => {
      await result.current.trigger();
    });

    expect(result.current.getValues('invalidAgentSkills')).toEqual([]);
    expect(result.current.formState.errors.agentSkills).toBeUndefined();
  });
});
