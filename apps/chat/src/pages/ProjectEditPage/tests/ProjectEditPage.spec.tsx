import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { ProjectContextFile } from '@epam/ai-dial-projects';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotFoundI18nKeys,
  ProjectsI18nKeys,
  UnsavedChangesI18nKeys,
} from '../../../constants/translation-keys';
import { useUser } from '../../../context/auth/UserContext';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
import { getProject, updateProject } from '../../../server-api/projects.api';
import ProjectEditPage from '../ProjectEditPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
vi.mock('../../../context/auth/UserContext', () => ({ useUser: vi.fn() }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));
const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
}));
const userConfig = vi.hoisted(() => ({ replacePinnedProjectId: vi.fn() }));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => userConfig,
}));
vi.mock('../../../server-api/projects.api', () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock(
  '../../../components/ProjectFileManagerModal/ProjectFileManagerModal',
  () => ({ default: () => null }),
);

interface FakeFormProps {
  values: { name: string; description: string; instructions: string };
  errors: { name?: string; context?: string };
  onFieldChange: (field: string, value: string) => void;
  contextFiles: ProjectContextFile[];
  onContextFilesChange: (files: ProjectContextFile[]) => void;
  onCancel: () => void;
  onSubmit: () => void;
  labels: { title: string; createLabel: string };
}

const formProps: { current?: FakeFormProps } = {};

vi.mock('@epam/ai-dial-projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-projects')>()),
  ProjectCreateForm: (props: FakeFormProps) => {
    formProps.current = props;
    return (
      <form>
        <h1>{props.labels.title}</h1>
        <input
          aria-label="name"
          value={props.values.name}
          onChange={(event) => props.onFieldChange('name', event.target.value)}
        />
        <ul>
          {props.contextFiles.map((file) => (
            <li key={file.id}>
              {file.name}
              <button
                type="button"
                onClick={() =>
                  props.onContextFilesChange(
                    props.contextFiles.filter((f) => f.id !== file.id),
                  )
                }
              >
                remove {file.name}
              </button>
            </li>
          ))}
        </ul>
        {props.errors.name && <p role="alert">{props.errors.name}</p>}
        {props.errors.context && <p role="alert">{props.errors.context}</p>}
        <button
          type="button"
          onClick={() =>
            props.onContextFilesChange([
              ...props.contextFiles,
              {
                id: 'new-1',
                name: 'retro.pdf',
                contentType: 'application/pdf',
                file: new File(['%PDF-'], 'retro.pdf'),
              } as Attachment,
            ])
          }
        >
          add file
        </button>
        <button type="button" onClick={props.onCancel}>
          cancel
        </button>
        <button type="button" onClick={props.onSubmit}>
          {props.labels.createLabel}
        </button>
      </form>
    );
  },
}));

const details = (
  extra: Partial<ProjectDetailsDto> = {},
): ProjectDetailsDto => ({
  id: 'projects/my-bucket/q4',
  name: 'q4',
  bucket: 'my-bucket',
  path: 'q4',
  source: ProjectSource.Personal,
  description: 'About',
  instructions: '## Steps',
  contextFiles: [
    { name: 'tickets.csv', size: 2048 },
    { name: 'survey.xlsx', size: 1024 },
  ],
  etag: '"e1"',
  canEdit: true,
  ...extra,
});

const READY_CONFIG = {
  status: 'ready',
  config: {
    aiTextRefinementAvailable: false,
    projectContextAllowedExtensions: ['csv', 'pdf', 'xlsx'],
    projectContextFileMaxBytes: 1_048_576,
    projectContextTotalMaxBytes: 10_485_760,
  },
};

const responseError = (status: number, body: unknown) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const renderAt = (path = '/projects/edit/my-bucket/q4') =>
  renderWithLeaveGuard(
    <Routes>
      <Route path="/projects/edit/:bucket/*" element={<ProjectEditPage />} />
      <Route path="/projects/view/:bucket/*" element={<p>project view</p>} />
      <Route path="/projects" element={<p>projects list</p>} />
    </Routes>,
    [path],
  );

const typeName = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'name' }), {
    target: { value },
  });

describe('ProjectEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formProps.current = undefined;
    useAppConfigMock.mockReturnValue(READY_CONFIG);
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(getProject).mockResolvedValue(details());
  });

  it('renders NotFound without a request when the flag is off', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAt();

    expect(screen.getByText(NotFoundI18nKeys.Title)).toBeTruthy();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('prefills the form from the project with stored context files', async () => {
    renderAt();

    expect(
      await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle }),
    ).toBeTruthy();
    expect(formProps.current?.values).toEqual({
      name: 'q4',
      description: 'About',
      instructions: '## Steps',
    });
    expect(formProps.current?.contextFiles.map((file) => file.name)).toEqual([
      'tickets.csv',
      'survey.xlsx',
    ]);
  });

  it('sends the project to its view page when it cannot be edited', async () => {
    vi.mocked(getProject).mockResolvedValue(
      details({ source: ProjectSource.Shared, canEdit: false }),
    );
    const { router } = renderAt();

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/projects/view/my-bucket/q4',
      ),
    );
    expect(formProps.current).toBeUndefined();
  });

  it('leaves without a prompt when nothing changed', async () => {
    const { router } = renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(await screen.findByText('project view')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/projects/view/my-bucket/q4');
  });

  it('asks before leaving after a stored file is removed', async () => {
    renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    await userEvent.click(
      screen.getByRole('button', { name: 'remove survey.xlsx' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(
      await screen.findByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('saves only the new files and the removed names with the loaded ETag', async () => {
    vi.mocked(updateProject).mockResolvedValue({
      id: 'projects/my-bucket/q4',
      name: 'q4',
      bucket: 'my-bucket',
      path: 'q4',
      etag: '"e2"',
      isPinned: false,
    });
    const { router } = renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    await userEvent.click(
      screen.getByRole('button', { name: 'remove survey.xlsx' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'add file' }));
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/projects/view/my-bucket/q4',
      ),
    );
    const [id, fields, files, removed, etag] =
      vi.mocked(updateProject).mock.calls[0];
    expect(id).toBe('projects/my-bucket/q4');
    expect(fields).toEqual({
      name: 'q4',
      description: 'About',
      instructions: '## Steps',
    });
    expect(files.map((file) => file.name)).toEqual(['retro.pdf']);
    expect(removed).toEqual(['survey.xlsx']);
    expect(etag).toBe('"e1"');
    expect(
      screen.queryByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
    ).toBeNull();
  });

  it('opens the renamed project and keeps its pin', async () => {
    vi.mocked(updateProject).mockResolvedValue({
      id: 'projects/my-bucket/Q4 launch',
      name: 'Q4 launch',
      bucket: 'my-bucket',
      path: 'Q4 launch',
      etag: '"e2"',
      isPinned: true,
    });
    const { router } = renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    typeName(' Q4 launch ');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/projects/view/my-bucket/Q4%20launch',
      ),
    );
    expect(vi.mocked(updateProject).mock.calls[0][1].name).toBe('Q4 launch');
    expect(userConfig.replacePinnedProjectId).toHaveBeenCalledWith(
      'projects/my-bucket/q4',
      'projects/my-bucket/Q4 launch',
    );
    /* The edit entry is replaced, so Back does not reopen the old id. */
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('drops the local pin when the BFF reports the renamed project unpinned', async () => {
    vi.mocked(updateProject).mockResolvedValue({
      id: 'projects/my-bucket/Q4 launch',
      name: 'Q4 launch',
      bucket: 'my-bucket',
      path: 'Q4 launch',
      etag: '"e2"',
      isPinned: false,
    });
    const { router } = renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    typeName('Q4 launch');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/projects/view/my-bucket/Q4%20launch',
      ),
    );
    expect(userConfig.replacePinnedProjectId).toHaveBeenCalledWith(
      'projects/my-bucket/q4',
      null,
    );
  });

  it('explains a project too large to edit in a toast', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      responseError(413, { code: 'project-too-large' }),
    );
    renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    typeName('Handbook');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() =>
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ProjectsI18nKeys.EditToastTooLarge,
        }),
      ),
    );
  });

  it('shows a taken name inline without a toast', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      responseError(409, { code: 'name-taken', field: 'name' }),
    );
    renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    typeName('Handbook');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      ProjectsI18nKeys.CreateErrorNameTaken,
    );
    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  it('offers a reload when the project changed elsewhere and keeps the draft', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      responseError(409, { code: 'project-changed' }),
    );
    renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    typeName('Draft name');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalled());
    const [notification] = showNotificationMock.mock.calls[0];
    expect(notification).toMatchObject({
      message: ProjectsI18nKeys.ErrorsChangedElsewhere,
    });
    expect(notification.action).toBeTruthy();
    expect(formProps.current?.values.name).toBe('Draft name');
  });

  it('puts a file rejection under Context', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      responseError(413, { code: 'capacity-exceeded' }),
    );
    renderAt();
    await screen.findByRole('heading', { name: ProjectsI18nKeys.EditTitle });

    await userEvent.click(screen.getByRole('button', { name: 'add file' }));
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      ProjectsI18nKeys.CreateErrorFilesRejected,
    );
  });

  it('shows the not-found state for a missing project', async () => {
    vi.mocked(getProject).mockRejectedValue(
      new ResponseError(new Response(null, { status: 404 })),
    );
    renderAt();

    expect(await screen.findByText(ProjectsI18nKeys.ViewNotFound)).toBeTruthy();
    expect(formProps.current).toBeUndefined();
  });
});
