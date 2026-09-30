import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { getApplicationSchema } from '../../../server-api/application-schemas';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { ApplicationEditorKind } from '../../../types/application-editor';
import { ROUTES } from '../../../types/routes';
import ApplicationEditorPage from '../ApplicationEditorPage';

vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}));
vi.mock('../../../server-api/application-schemas', () => ({
  getApplicationSchema: vi.fn(),
}));
vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({ notifyOperationSuccess: vi.fn() }),
}));
vi.mock(
  '../../../components/DialFileManagerModal/DialFileManagerModal',
  () => ({ default: () => null }),
);

const SCHEMA_ID = 'https://example.com/schemas/text-classification';
const SUMMARY = {
  id: SCHEMA_ID,
  displayName: 'Text classification',
  hasProperties: true,
};
const FULL_SCHEMA = {
  $id: SCHEMA_ID,
  type: 'object',
  properties: { labels: { type: 'string', title: 'Labels' } },
  required: ['labels'],
};
const APP_ID = 'applications/bucket/classifier';

const renderPage = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`${ROUTES.AppsEditor}?${search}`]}>
      <Routes>
        <Route
          path={ROUTES.AppsEditor}
          element={
            <ApplicationEditorPage kind={ApplicationEditorKind.QuickApp} />
          }
        />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
      </Routes>
    </MemoryRouter>,
  );

/* The layout renders its actions in the header and again in the mobile bar; take the header copy. */
const getAction = (name: string) =>
  screen.getAllByRole('button', { name })[0] as HTMLButtonElement;
/* The kit's schema renderer names the field's group, not its input, so the input is found inside the group. */
const findLabelsInput = async () =>
  within(await screen.findByRole('group', { name: /Labels/ })).getByRole(
    'textbox',
  ) as HTMLInputElement;
const getNameInput = () =>
  screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false });

const createSearch = `schema=${SCHEMA_ID}`;
const editSearch = `${createSearch}&appId=${encodeURIComponent(APP_ID)}`;

describe('ApplicationEditorPage — schema app', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApplicationSchema).mockResolvedValue(FULL_SCHEMA);
    vi.mocked(createApplication).mockResolvedValue({ id: APP_ID } as never);
    vi.mocked(updateApplication).mockResolvedValue({ id: APP_ID } as never);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
      schemas: [SUMMARY],
      items: [],
      isLoading: false,
      refetchDeployments: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  it('renders the form built from the schema instead of an embedded editor', async () => {
    renderPage(createSearch);

    expect(await findLabelsInput()).toBeTruthy();
    expect(getApplicationSchema).toHaveBeenCalledWith(SCHEMA_ID);
  });

  it('blocks creation while a required schema property is empty', async () => {
    renderPage(createSearch);
    await findLabelsInput();

    await user.type(getNameInput(), 'Classifier');
    await user.click(getAction(ButtonsI18nKeys.Create));

    expect(
      await screen.findByText(AppsEditorI18nKeys.SchemaFormRequiredMissing),
    ).toBeTruthy();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('creates the app in one request carrying the form values as applicationProperties', async () => {
    renderPage(createSearch);

    await user.type(getNameInput(), 'Classifier');
    await user.type(await findLabelsInput(), 'spam,ham');
    await user.click(getAction(ButtonsI18nKeys.Create));

    await waitFor(() =>
      expect(createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Classifier',
          type: SCHEMA_ID,
          applicationProperties: { labels: 'spam,ham' },
        }),
      ),
    );
    expect(await screen.findByText('Catalog')).toBeTruthy();
  });

  it("prefills an edited app's saved properties and saves them back", async () => {
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
      schemas: [SUMMARY],
      items: [
        {
          id: APP_ID,
          displayName: 'Classifier',
          displayVersion: '1.0.0',
          applicationTypeSchemaId: SCHEMA_ID,
        },
      ],
      isLoading: false,
      refetchDeployments: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
    vi.mocked(getDeploymentDetails).mockResolvedValue({
      applicationDetails: { applicationProperties: { labels: 'a,b' } },
    } as never);
    renderPage(editSearch);

    const labels = await findLabelsInput();
    expect(labels.value).toBe('a,b');

    await user.type(labels, ',c');
    await user.click(getAction(ButtonsI18nKeys.Save));

    await waitFor(() =>
      expect(updateApplication).toHaveBeenCalledWith(
        APP_ID,
        expect.objectContaining({
          applicationProperties: { labels: 'a,b,c' },
        }),
      ),
    );
  });

  it('shows the load error when the schema cannot be fetched', async () => {
    vi.mocked(getApplicationSchema).mockRejectedValue(new Error('502'));
    renderPage(createSearch);

    expect(
      await screen.findByText(AppsEditorI18nKeys.SchemaFormLoadFailed),
    ).toBeTruthy();
  });
});
