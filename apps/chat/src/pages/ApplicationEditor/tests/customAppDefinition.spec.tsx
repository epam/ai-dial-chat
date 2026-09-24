import type { DeploymentDetailsDto } from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  CustomAppI18nKeys,
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { ApplicationEditorKind } from '../../../types/application-editor';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import ApplicationEditorPage from '../ApplicationEditorPage';

vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [],
    refetchDeployments: mockRefetchDeployments,
    isLoading: false,
  }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mockNotifyOperationSuccess,
  }),
}));
vi.mock(
  '../../../components/DialFileManagerModal/DialFileManagerModal',
  () => ({ default: () => null }),
);
vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}));
vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

const mockShowNotification = vi.fn();
const mockRefetchDeployments = vi.fn();
const mockNotifyOperationSuccess = vi.fn();

const APP_ID = 'applications/bucket/my-app__1.0.0';

const renderPage = (initialEntry: string = ROUTES.CustomAppEditor) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path={ROUTES.CustomAppEditor}
          element={
            <ApplicationEditorPage kind={ApplicationEditorKind.CustomApp} />
          }
        />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
      </Routes>
    </MemoryRouter>,
  );

/* The layout renders its actions in the header and again in the mobile bar; take the header copy. */
const getAction = (name: string) => screen.getAllByRole('button', { name })[0];

/* Required labels carry an sr-only "(required)" suffix, hence the loose match. */
const getNameInput = () =>
  screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false });
const getCompletionUrlInput = () =>
  screen.getByLabelText(CustomAppI18nKeys.CompletionUrlLabel, { exact: false });

describe('ApplicationEditorPage — custom app', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    vi.mocked(createApplication).mockResolvedValue({} as never);
    vi.mocked(updateApplication).mockResolvedValue({} as never);
    mockRefetchDeployments.mockResolvedValue(undefined);
  });

  const fillValidForm = async () => {
    await user.type(getNameInput(), 'My app');
    await user.type(getCompletionUrlInput(), 'https://api.example.com/chat');
  };

  it('renders the Metadata and Setup sections together with no step navigation', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: CustomAppI18nKeys.CreateTitle,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: ToolsetEditorI18nKeys.MetadataSectionTitle,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: ToolsetEditorI18nKeys.SetupSectionTitle,
      }),
    ).toBeTruthy();
    expect(getNameInput()).toBeTruthy();
    expect(
      screen.getByLabelText(CustomAppI18nKeys.FeaturesDataLabel),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: EditorI18nKeys.NextButton }),
    ).toBeNull();
  });

  it('shows the name-required error on blur', async () => {
    renderPage();

    await user.click(getNameInput());
    await user.tab();

    expect(screen.getByText(EditorI18nKeys.NameRequired)).toBeTruthy();
  });

  it('blocks the request, shows the error and focuses Name when Create is clicked with a blank name', async () => {
    renderPage();

    await user.click(getAction(ButtonsI18nKeys.Create));

    expect(screen.getByText(EditorI18nKeys.NameRequired)).toBeTruthy();
    expect(getNameInput().matches(':focus')).toBe(true);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('shows the completion url error when the field loses focus with an invalid value', async () => {
    renderPage();

    await user.type(getCompletionUrlInput(), 'not a url');
    await user.tab();

    expect(
      screen.getByText(CustomAppI18nKeys.CompletionUrlInvalid),
    ).toBeTruthy();
  });

  it('blocks the request when an attachment type is not a MIME type', async () => {
    renderPage();
    await fillValidForm();
    await user.type(
      screen.getByLabelText(CustomAppI18nKeys.AttachmentTypesLabel),
      'not-a-mime{Enter}',
    );

    await user.click(getAction(ButtonsI18nKeys.Create));

    expect(
      screen.getAllByText(CustomAppI18nKeys.InvalidMimeType).length,
    ).toBeGreaterThan(0);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('creates the application in one request, confirms it and returns to the catalog', async () => {
    renderPage();
    await fillValidForm();

    await user.click(getAction(ButtonsI18nKeys.Create));

    await screen.findByText('Catalog');
    expect(createApplication).toHaveBeenCalledOnce();
    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My app',
        applicationProperties: expect.objectContaining({
          endpoint: 'https://api.example.com/chat',
        }),
      }),
    );
    expect(mockRefetchDeployments).toHaveBeenCalled();
    expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.CustomApp,
      EntityOperation.Created,
      { name: 'My app' },
    );
  });

  it('asks for confirmation before saving invalid features data', async () => {
    renderPage();
    await fillValidForm();
    await user.type(
      screen.getByLabelText(CustomAppI18nKeys.FeaturesDataLabel),
      'not json',
    );

    await user.click(getAction(ButtonsI18nKeys.Create));

    expect(createApplication).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('button', {
        name: CustomAppI18nKeys.SaveConfirmLabel,
      }),
    );

    await waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
  });

  it('raises an error notification and stays on the page when the request fails', async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error('boom'));
    renderPage();
    await fillValidForm();

    await user.click(getAction(ButtonsI18nKeys.Create));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      ),
    );
    expect(screen.queryByText('Catalog')).toBeNull();
  });

  describe('edit mode', () => {
    const editEntry = `${ROUTES.CustomAppEditor}?id=${encodeURIComponent(APP_ID)}`;

    it('loads the Features textarea from customAppFeatures', async () => {
      vi.mocked(getDeploymentDetails).mockResolvedValue({
        id: APP_ID,
        type: 'application',
        applicationDetails: {
          applicationProperties: { someUnrelatedKey: 'value' },
          customAppFeatures: { rate: true },
          endpoint: 'https://api.example.com/chat',
        },
      } as DeploymentDetailsDto);

      renderPage(editEntry);

      await waitFor(() =>
        expect(
          (
            screen.getByLabelText(
              CustomAppI18nKeys.FeaturesDataLabel,
            ) as HTMLTextAreaElement
          ).value,
        ).toBe(JSON.stringify({ rate: true }, null, '\t')),
      );
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: CustomAppI18nKeys.EditTitle,
        }),
      ).toBeTruthy();
    });

    it('saves through updateApplication', async () => {
      vi.mocked(getDeploymentDetails).mockResolvedValue({
        id: APP_ID,
        type: 'application',
        applicationDetails: { endpoint: 'https://api.example.com/chat' },
      } as DeploymentDetailsDto);
      renderPage(editEntry);
      await waitFor(() =>
        expect((getCompletionUrlInput() as HTMLInputElement).value).toBe(
          'https://api.example.com/chat',
        ),
      );
      await user.type(getNameInput(), 'My app');

      await user.click(getAction(ButtonsI18nKeys.Save));

      await waitFor(() =>
        expect(updateApplication).toHaveBeenCalledWith(
          APP_ID,
          expect.objectContaining({
            name: 'My app',
            endpoint: 'https://api.example.com/chat',
          }),
        ),
      );
      expect(createApplication).not.toHaveBeenCalled();
    });

    it('returns to the catalog with an error when the settings cannot be loaded', async () => {
      vi.mocked(getDeploymentDetails).mockRejectedValue(new Error('404'));

      renderPage(editEntry);

      await screen.findByText('Catalog');
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: NotificationVariant.Error,
          message: CustomAppI18nKeys.ErrorLoadFailed,
        }),
      );
    });
  });
});
