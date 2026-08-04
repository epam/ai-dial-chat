import { StepStatus } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import { ToolsetEditorSteps } from '../../../constants/toolsets';
import ToolsetEditorHeader from '../ToolsetEditorHeader';

interface MockStep {
  id: string;
  name: string;
  status?: string;
}

interface MockEditorHeaderProps {
  steps: MockStep[];
  isSaveDisabled?: boolean;
  onChangeStep: (stepId: string) => void;
}

const mockEditorHeader = vi.hoisted(() =>
  vi.fn(({ steps, onChangeStep }: MockEditorHeaderProps) => (
    <div>
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onChangeStep(step.id)}
        >
          {step.name}
        </button>
      ))}
    </div>
  )),
);

vi.mock('../../../components/EditorHeader/EditorHeader', () => ({
  default: mockEditorHeader,
}));

describe('ToolsetEditorHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mark Settings as selectable before General has a name', () => {
    render(
      <ToolsetEditorHeader
        step={ToolsetEditorSteps.General}
        isSaving={false}
        isSaveDisabled={false}
        canOpenSettings={false}
        onChangeStep={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const props = mockEditorHeader.mock.calls[0]?.[0] as
      | MockEditorHeaderProps
      | undefined;

    expect(props?.steps).toEqual([
      {
        id: ToolsetEditorSteps.General,
        name: EditorI18nKeys.StepGeneral,
        status: undefined,
      },
      {
        id: ToolsetEditorSteps.Settings,
        name: BasicI18nKeys.Settings,
        status: undefined,
      },
    ]);
  });

  it('marks both steps as valid so Settings can be selected from General', () => {
    render(
      <ToolsetEditorHeader
        step={ToolsetEditorSteps.General}
        isSaving={false}
        isSaveDisabled={false}
        canOpenSettings
        onChangeStep={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const props = mockEditorHeader.mock.calls[0]?.[0] as
      | MockEditorHeaderProps
      | undefined;

    expect(props?.steps).toEqual([
      {
        id: ToolsetEditorSteps.General,
        name: EditorI18nKeys.StepGeneral,
        status: StepStatus.VALID,
      },
      {
        id: ToolsetEditorSteps.Settings,
        name: BasicI18nKeys.Settings,
        status: StepStatus.VALID,
      },
    ]);
  });

  it('forwards Settings tab clicks to the editor step handler', async () => {
    const onChangeStep = vi.fn();
    render(
      <ToolsetEditorHeader
        step={ToolsetEditorSteps.General}
        isSaving={false}
        isSaveDisabled={false}
        canOpenSettings
        onChangeStep={onChangeStep}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: BasicI18nKeys.Settings,
      }),
    );

    expect(onChangeStep).toHaveBeenCalledWith(ToolsetEditorSteps.Settings);
  });

  it('forwards the Save disabled state to the shared header', () => {
    render(
      <ToolsetEditorHeader
        step={ToolsetEditorSteps.Settings}
        isSaving={false}
        isSaveDisabled
        canOpenSettings
        onChangeStep={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const props = mockEditorHeader.mock.calls[0]?.[0] as
      | MockEditorHeaderProps
      | undefined;

    expect(props?.isSaveDisabled).toBe(true);
  });
});
