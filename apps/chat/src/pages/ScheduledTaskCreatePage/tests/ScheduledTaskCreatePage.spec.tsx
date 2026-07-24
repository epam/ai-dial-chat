import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import ScheduledTaskCreatePage from '../ScheduledTaskCreatePage';

const useFeatureFlagMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
}));

const useDeploymentsMock = vi.fn();
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => useDeploymentsMock(),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const createScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  createScheduledTask: (...args: unknown[]) => createScheduledTaskMock(...args),
}));

interface FormProps {
  texts: { cancelButtonLabel: string; createButtonLabel: string };
  values: {
    displayName: string;
    modelId: string;
    prompt: string;
    scheduleType: string;
  };
  errors: Record<string, string | undefined>;
  modelOptions: { id: string; label: string }[];
  onFieldChange: (field: string, value: unknown) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

vi.mock('@epam/ai-dial-scheduled-tasks', () => ({
  ScheduledTaskCreateForm: ({
    texts,
    values,
    errors,
    modelOptions,
    onFieldChange,
    onCancel,
    onSubmit,
    isSubmitting,
  }: FormProps): ReactNode => (
    <div>
      <input
        aria-label="displayName"
        value={values.displayName}
        onChange={(e) => onFieldChange('displayName', e.target.value)}
      />
      <select
        aria-label="modelId"
        value={values.modelId}
        onChange={(e) => onFieldChange('modelId', e.target.value)}
      >
        <option value="" />
        {modelOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <textarea
        aria-label="prompt"
        value={values.prompt}
        onChange={(e) => onFieldChange('prompt', e.target.value)}
      />
      {errors.displayName && <span>{errors.displayName}</span>}
      {errors.modelId && <span>{errors.modelId}</span>}
      {errors.prompt && <span>{errors.prompt}</span>}
      <button onClick={onCancel}>{texts.cancelButtonLabel}</button>
      <button onClick={onSubmit} disabled={isSubmitting}>
        {texts.createButtonLabel}
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
  });

  it('renders the NotFound page when scheduledTasksEnabled is false', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute('/scheduled-tasks/new');

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
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

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(screen.getByText('editor.nameRequired')).toBeTruthy();
  });

  it('submits the mapped body and navigates to returnUrl on success', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new?returnUrl=%2Fcustom');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.displayName).toBe('Daily summary');
    expect(body.model).toBe('gpt-4o');
    expect(body.prompt).toBe('Summarize my inbox');
    expect(body.trigger).toBeDefined();

    expect(await screen.findByText('custom return page')).toBeTruthy();
    expect(showNotificationMock).toHaveBeenCalledOnce();
  });

  it('shows an error notification and stays on the form when the API call fails', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('upstream failure'));
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

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
