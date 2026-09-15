import type { DeploymentDetailsDto } from '@epam/ai-dial-chat-api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { ROUTES } from '../../../types/routes';
import CustomAppEditorPage from '../CustomAppEditor';

/*
 * Swaps the lib General step for a stub exposing just the name field, so the
 * wizard can be driven past the General → Settings gate without mounting the
 * avatar picker and the file-manager modal.
 */
vi.mock('@epam/ai-dial-toolset-editor', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-toolset-editor')>();

  const GeneralFormStub = (props: {
    form: { name: string };
    onChange: (patch: { name: string }) => void;
  }) => (
    <input
      aria-label="general-name"
      value={props.form.name}
      onChange={(event) => props.onChange({ name: event.target.value })}
    />
  );

  return { ...actual, GeneralForm: GeneralFormStub };
});

vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [],
    refetchDeployments: vi.fn(),
    isLoading: false,
  }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({ notifyOperationSuccess: vi.fn() }),
}));
vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}));
vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

const mockShowNotification = vi.fn();

const renderPage = (initialEntry: string = ROUTES.CustomAppEditor) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path={ROUTES.CustomAppEditor}
          element={<CustomAppEditorPage />}
        />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
      </Routes>
    </MemoryRouter>,
  );

const goToSettingsStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', { name: EditorI18nKeys.NextButton }),
  );
};

const goToGeneralStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', { name: EditorI18nKeys.StepGeneral }),
  );
};

describe('CustomAppEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  const fillNameAndOpenSettings = async () => {
    await user.type(screen.getByLabelText('general-name'), 'My app');
    await goToSettingsStep(user);
  };

  it('keeps the features data error visible after returning from the General step', async () => {
    renderPage();
    await fillNameAndOpenSettings();

    const featuresData = screen.getByLabelText(
      CustomAppI18nKeys.FeaturesDataLabel,
    );
    await user.type(featuresData, 'test');
    expect(
      screen.getByText(CustomAppI18nKeys.FeaturesDataInvalid),
    ).toBeTruthy();

    await goToGeneralStep(user);
    await goToSettingsStep(user);

    expect(
      (
        screen.getByLabelText(
          CustomAppI18nKeys.FeaturesDataLabel,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('test');
    expect(
      screen.getByText(CustomAppI18nKeys.FeaturesDataInvalid),
    ).toBeTruthy();
  });

  it('keeps the attachment type error visible after returning from the General step', async () => {
    renderPage();
    await fillNameAndOpenSettings();

    await user.type(
      screen.getByLabelText(CustomAppI18nKeys.AttachmentTypesLabel),
      'not-a-mime{Enter}',
    );
    expect(screen.getByText(CustomAppI18nKeys.InvalidMimeType)).toBeTruthy();

    await goToGeneralStep(user);
    await goToSettingsStep(user);

    expect(screen.getByText(CustomAppI18nKeys.InvalidMimeType)).toBeTruthy();
  });

  it('keeps the completion url error visible after returning from the General step', async () => {
    renderPage();
    await fillNameAndOpenSettings();

    /* The label carries an sr-only "(required)" suffix, hence the loose match. */
    const completionUrl = screen.getByLabelText(
      CustomAppI18nKeys.CompletionUrlLabel,
      { exact: false },
    );
    await user.type(completionUrl, 'not a url');
    await user.tab();
    expect(
      screen.getByText(CustomAppI18nKeys.CompletionUrlInvalid),
    ).toBeTruthy();

    await goToGeneralStep(user);
    await goToSettingsStep(user);

    expect(
      screen.getByText(CustomAppI18nKeys.CompletionUrlInvalid),
    ).toBeTruthy();
  });

  it('reads the Features textarea value from customAppFeatures, leaving an unrelated applicationProperties key untouched', async () => {
    vi.mocked(getDeploymentDetails).mockResolvedValue({
      id: 'applications/bucket/my-app__1.0.0',
      type: 'application',
      applicationDetails: {
        applicationProperties: { someUnrelatedKey: 'value' },
        customAppFeatures: { rate: true },
        endpoint: 'https://api.example.com/chat',
      },
    } as DeploymentDetailsDto);

    renderPage(
      `${ROUTES.CustomAppEditor}?id=${encodeURIComponent('applications/bucket/my-app__1.0.0')}`,
    );

    await user.type(await screen.findByLabelText('general-name'), 'My app');
    await goToSettingsStep(user);

    const featuresData = screen.getByLabelText(
      CustomAppI18nKeys.FeaturesDataLabel,
    ) as HTMLTextAreaElement;
    expect(featuresData.value).toBe(JSON.stringify({ rate: true }, null, '\t'));
  });

  it('clears the features data error once the value becomes valid', async () => {
    renderPage();
    await fillNameAndOpenSettings();

    const featuresData = screen.getByLabelText(
      CustomAppI18nKeys.FeaturesDataLabel,
    );
    await user.type(featuresData, 'test');
    expect(
      screen.getByText(CustomAppI18nKeys.FeaturesDataInvalid),
    ).toBeTruthy();

    await user.clear(featuresData);
    expect(
      screen.queryByText(CustomAppI18nKeys.FeaturesDataInvalid),
    ).toBeNull();
  });
});
