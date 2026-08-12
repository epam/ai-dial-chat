import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import ScheduledTaskCreatePage from '../ScheduledTaskCreatePage';

const useFeatureFlagMock = vi.fn();
const useAppConfigMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
  useAppConfig: () => useAppConfigMock(),
}));

const useDeploymentsMock = vi.fn();
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => useDeploymentsMock(),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const useThemeMock = vi.fn();
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => useThemeMock(),
}));

const createScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  createScheduledTask: (...args: unknown[]) => createScheduledTaskMock(...args),
}));

vi.mock(
  '../../../components/DeploymentSelector/DeploymentSelectorFieldTrigger',
  () => ({
    default: ({
      selectedId,
      onSelect,
      labelledById,
    }: {
      selectedId: string | null;
      onSelect: (id: string) => void;
      labelledById?: string;
    }) => (
      <>
        <select
          aria-label="modelId"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" />
          <option value="gpt-4o">GPT-4o</option>
        </select>
        <output aria-label="triggerLabelledById">{labelledById}</output>
      </>
    ),
  }),
);

interface FormProps {
  labels: { cancelButtonLabel: string; createButtonLabel: string };
  values: {
    displayName: string;
    modelId: string;
    prompt: string;
    description?: string;
    repeat: string;
    startDate?: string;
    endDate?: string;
    runAt?: string;
  };
  errors: Record<string, string | undefined>;
  modelSelector: ReactNode;
  modelLabelId: string;
  onFieldChange: (field: string, value: unknown) => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

vi.mock('@epam/ai-dial-scheduled-tasks', () => ({
  ScheduledTaskRepeat: {
    OneTime: 'oneTime',
    Hourly: 'hourly',
    Daily: 'daily',
    Weekly: 'weekly',
    Monthly: 'monthly',
  },
  DESCRIPTION_MAX_LENGTH: 500,
  ScheduledTaskCreateForm: ({
    labels,
    values,
    errors,
    modelSelector,
    modelLabelId,
    onFieldChange,
    onBack,
    onCancel,
    onSubmit,
    isSubmitting,
  }: FormProps): ReactNode => (
    <div>
      <button onClick={onBack}>back</button>
      <input
        aria-label="displayName"
        value={values.displayName}
        onChange={(e) => onFieldChange('displayName', e.target.value)}
      />
      <output aria-label="modelLabelId">{modelLabelId}</output>
      {modelSelector}
      <textarea
        aria-label="prompt"
        value={values.prompt}
        onChange={(e) => onFieldChange('prompt', e.target.value)}
      />
      <textarea
        aria-label="description"
        value={values.description ?? ''}
        onChange={(e) => onFieldChange('description', e.target.value)}
      />
      <select
        aria-label="repeat"
        value={values.repeat}
        onChange={(e) => onFieldChange('repeat', e.target.value)}
      >
        <option value="oneTime">oneTime</option>
        <option value="hourly">hourly</option>
        <option value="daily">daily</option>
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </select>
      <input
        aria-label="startDate"
        value={values.startDate ?? ''}
        onChange={(e) => onFieldChange('startDate', e.target.value)}
      />
      <input
        aria-label="endDate"
        value={values.endDate ?? ''}
        onChange={(e) => onFieldChange('endDate', e.target.value)}
      />
      <input
        aria-label="runAt"
        value={values.runAt ?? ''}
        onChange={(e) => onFieldChange('runAt', e.target.value)}
      />
      {errors.displayName && <span>{errors.displayName}</span>}
      {errors.modelId && <span>{errors.modelId}</span>}
      {errors.prompt && <span>{errors.prompt}</span>}
      {errors.description && <span>{errors.description}</span>}
      {errors.endDate && <span>{errors.endDate}</span>}
      <button onClick={onCancel}>{labels.cancelButtonLabel}</button>
      <button onClick={onSubmit} disabled={isSubmitting}>
        {labels.createButtonLabel}
      </button>
    </div>
  ),
}));

const renderAtRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/scheduled-tasks/new"
          element={<ScheduledTaskCreatePage />}
        />
        <Route path="/scheduled-tasks" element={<div>list page</div>} />
        <Route path="/custom" element={<div>custom return page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fillValidForm = async () => {
  await userEvent.type(
    screen.getByRole('textbox', { name: 'displayName' }),
    'Daily summary',
  );
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'modelId' }),
    'gpt-4o',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'prompt' }),
    'Summarize my inbox',
  );
};

describe('ScheduledTaskCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFeatureFlagMock.mockReturnValue(true);
    useDeploymentsMock.mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: 'GPT-4o' }],
    });
    useThemeMock.mockReturnValue({ currentTheme: 'light' });
    useAppConfigMock.mockReturnValue({ status: 'ready' });
  });

  it('renders a fallback instead of NotFound while app config is still loading', () => {
    useAppConfigMock.mockReturnValue({ status: 'loading' });
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute('/scheduled-tasks/new');

    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
  });

  it('renders the NotFound page when scheduledTasksEnabled is false', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute('/scheduled-tasks/new');

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('links the model field label to the trigger via a generated id, not a hardcoded literal', () => {
    renderAtRoute('/scheduled-tasks/new');

    const modelLabelId = screen.getByLabelText('modelLabelId').textContent;
    const triggerLabelledById = screen.getByLabelText(
      'triggerLabelledById',
    ).textContent;

    expect(modelLabelId).toBeTruthy();
    expect(triggerLabelledById).toBe(modelLabelId);
  });

  it('navigates to the default list route on Cancel when returnUrl is absent', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(screen.getByText('list page')).toBeTruthy();
    expect(createScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('navigates to the returnUrl on Cancel when provided', async () => {
    renderAtRoute('/scheduled-tasks/new?returnUrl=%2Fcustom');

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(screen.getByText('custom return page')).toBeTruthy();
  });

  it('navigates to the returnUrl on back without a network call', async () => {
    renderAtRoute('/scheduled-tasks/new?returnUrl=%2Fcustom');

    await userEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(screen.getByText('custom return page')).toBeTruthy();
    expect(createScheduledTaskMock).not.toHaveBeenCalled();
  });

  it.each([
    '/scheduled-tasks/new?returnUrl=',
    '/scheduled-tasks/new?returnUrl=https%3A%2F%2Fevil.example',
    '/scheduled-tasks/new?returnUrl=%2F%2Fevil.example',
    '/scheduled-tasks/new?returnUrl=%2F%5Cevil.example',
    '/scheduled-tasks/new?returnUrl=%2Fcustom%0A',
  ])(
    'falls back to the list route for invalid returnUrl in %s',
    async (url) => {
      renderAtRoute(url);

      await userEvent.click(
        screen.getByRole('button', { name: 'buttons.cancel' }),
      );

      expect(screen.getByText('list page')).toBeTruthy();
    },
  );

  it('does not submit when required fields are missing', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(screen.getByText('editor.nameRequired')).toBeTruthy();
  });

  it('binds the model selector to values.modelId and updates it on selection', async () => {
    renderAtRoute('/scheduled-tasks/new');

    const select = screen.getByRole('combobox', {
      name: 'modelId',
    }) as HTMLSelectElement;
    expect(select.value).toBe('');

    await userEvent.selectOptions(select, 'gpt-4o');

    expect(select.value).toBe('gpt-4o');
  });

  it('submits the mapped body and navigates to returnUrl on success', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new?returnUrl=%2Fcustom');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.displayName).toBe('Daily summary');
    expect(body.model).toBe('gpt-4o');
    expect(body.prompt).toBe('Summarize my inbox');
    expect(body.trigger).toBeDefined();

    expect(await screen.findByText('custom return page')).toBeTruthy();
    expect(showNotificationMock).toHaveBeenCalledOnce();
  });

  it('includes a trimmed description in the submit body when non-empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'description' }),
      '  Summarizes unread inbox items  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.description).toBe('Summarizes unread inbox items');
  });

  it('omits description from the submit body when empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.description).toBeUndefined();
  });

  it('blocks submit and shows a validation error when description exceeds 500 characters', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'description' }), {
      target: { value: 'a'.repeat(501) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('scheduledTasks.create.descriptionMaxLengthError'),
    ).toBeTruthy();
  });

  it('blocks submit with an inline error when endDate is not after startDate', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'startDate' }),
      '2026-08-31',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'endDate' }),
      '2026-08-01',
    );
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('scheduledTasks.create.endDateBeforeStartError'),
    ).toBeTruthy();
  });

  it('allows submit when both startDate and endDate are empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it('does not include startDate/endDate in the submit body after switching repeat to one-time', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'startDate' }),
      '2026-08-01',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'endDate' }),
      '2026-08-31',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'repeat' }),
      'oneTime',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'runAt' }),
      '2099-08-24T09:00',
    );
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.trigger.cron).toBeUndefined();
    expect(body.trigger).not.toHaveProperty('startDate');
    expect(body.trigger).not.toHaveProperty('endDate');
  });

  it('shows an error notification and stays on the form when the API call fails', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('upstream failure'));
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });

    expect(screen.queryByText('list page')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'displayName' })).toHaveProperty(
      'value',
      'Daily summary',
    );
  });
});
