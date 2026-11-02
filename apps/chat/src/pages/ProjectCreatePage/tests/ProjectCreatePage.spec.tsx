import {
  ResponseError,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
import {
  previewResolvers,
  withPreviewCanvas,
} from '../../../hooks/projects/tests/project-preview-test-helpers';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
import { createProject } from '../../../server-api/projects.api';
import { refineText } from '../../../server-api/text-refinement.api';
import ProjectCreatePage from '../ProjectCreatePage';

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
vi.mock('../../../server-api/projects.api', () => ({
  createProject: vi.fn(),
}));
vi.mock('../../../server-api/text-refinement.api', () => ({
  refineText: vi.fn(),
}));
vi.mock(
  '../../../components/ProjectFileManagerModal/ProjectFileManagerModal',
  () => ({ default: () => null }),
);
vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', async () => {
  const { previewCanvasResolvers: stub } =
    await import('../../../hooks/projects/tests/project-preview-test-helpers');
  return { useAttachmentCanvasResolvers: () => stub };
});

interface FakeFormProps {
  values: { name: string; instructions: string };
  errors: { name?: string; context?: string };
  onFieldChange: (field: string, value: string) => void;
  contextFiles: Attachment[];
  onContextFilesChange: (files: Attachment[]) => void;
  onContextFileClick?: (id: string) => void;
  selectedContextFileId?: string;
  allowedExtensions: string[];
  maxFileBytes: number;
  maxTotalBytes: number;
  onPickFromFileManager?: () => Promise<File[] | undefined>;
  onRefineInstructions?: (
    value: string,
    signal: AbortSignal,
  ) => Promise<string>;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  labels: { title: string };
}

const formProps: { current?: FakeFormProps } = {};

/* A minimal stand-in for the lib form: the page is under test, not the form. */
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
        {props.errors.name && <p role="alert">{props.errors.name}</p>}
        {props.errors.context && <p role="alert">{props.errors.context}</p>}
        <button
          type="button"
          onClick={() =>
            props.onContextFilesChange([
              ...props.contextFiles,
              {
                id: 'file-1',
                name: 'tickets.csv',
                contentType: 'text/csv',
                type: AttachmentType.File,
                status: RequestStatus.Idle,
                file: new File(['a,b'], 'tickets.csv', { type: 'text/csv' }),
              } as Attachment,
            ])
          }
        >
          add file
        </button>
        {props.contextFiles.map((file) => (
          <button
            key={file.id}
            type="button"
            aria-pressed={file.id === props.selectedContextFileId}
            onClick={() => props.onContextFileClick?.(file.id)}
          >
            {`Preview ${file.name}`}
          </button>
        ))}
        <button type="button" onClick={props.onCancel}>
          cancel
        </button>
        <button
          type="button"
          disabled={props.isSubmitting}
          onClick={props.onSubmit}
        >
          create
        </button>
      </form>
    );
  },
}));

const responseError = (status: number, body: unknown) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const READY_CONFIG = {
  status: 'ready',
  config: {
    aiTextRefinementAvailable: true,
    projectContextAllowedExtensions: ['csv', 'pdf', 'xlsx'],
    projectContextFileMaxBytes: 1_048_576,
    projectContextTotalMaxBytes: 10_485_760,
  },
};

const renderAtRoute = () =>
  renderWithLeaveGuard(
    withPreviewCanvas(
      <Routes>
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects" element={<p>projects list</p>} />
        <Route path="/projects/view/:bucket/*" element={<p>project view</p>} />
        <Route path="/catalog" element={<p>catalog page</p>} />
      </Routes>,
    ),
    ['/projects/new'],
  );

const typeName = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'name' }), {
    target: { value },
  });

describe('ProjectCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formProps.current = undefined;
    useAppConfigMock.mockReturnValue(READY_CONFIG);
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
  });

  it('renders NotFound without a request when the flag is off', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute();

    expect(screen.getByText(NotFoundI18nKeys.Title)).toBeTruthy();
    expect(formProps.current).toBeUndefined();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('passes the configured limits and the file manager source to the form', () => {
    renderAtRoute();

    expect(formProps.current).toMatchObject({
      allowedExtensions: ['csv', 'pdf', 'xlsx'],
      maxFileBytes: 1_048_576,
      maxTotalBytes: 10_485_760,
    });
    expect(formProps.current?.onPickFromFileManager).toBeTypeOf('function');
  });

  it('refines the instructions with the project purpose', async () => {
    vi.mocked(refineText).mockResolvedValue('Refined');
    renderAtRoute();

    await formProps.current?.onRefineInstructions?.(
      'steps',
      new AbortController().signal,
    );

    expect(refineText).toHaveBeenCalledOnce();
    expect(refineText).toHaveBeenCalledWith(
      TextRefinementPurpose.ProjectInstructions,
      'steps',
      expect.any(AbortSignal),
    );
  });

  it('supplies no refinement when the capability is unavailable', () => {
    useAppConfigMock.mockReturnValue({
      ...READY_CONFIG,
      config: { ...READY_CONFIG.config, aiTextRefinementAvailable: false },
    });
    renderAtRoute();

    expect(formProps.current?.onRefineInstructions).toBeUndefined();
  });

  it('creates a name-only project with a trimmed name and opens it', async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 'projects/my-bucket/Handbook',
      name: 'Handbook',
      bucket: 'my-bucket',
      path: 'Handbook',
    });
    const { router } = renderAtRoute();
    typeName('  Handbook  ');

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    expect(await screen.findByText('project view')).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      '/projects/view/my-bucket/Handbook',
    );
    expect(createProject).toHaveBeenCalledWith(
      { name: 'Handbook', instructions: '' },
      [],
      expect.any(AbortSignal),
    );
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: ProjectsI18nKeys.CreateToastSuccess }),
    );
    expect(
      screen.queryByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
    ).toBeNull();
  });

  it('sends the added context files with the request', async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 'projects/my-bucket/Q4',
      name: 'Q4',
      bucket: 'my-bucket',
      path: 'Q4',
    });
    renderAtRoute();
    typeName('Q4');
    await userEvent.click(screen.getByRole('button', { name: 'add file' }));

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() => expect(createProject).toHaveBeenCalledOnce());
    const [, files] = vi.mocked(createProject).mock.calls[0];
    expect(files.map((file) => file.name)).toEqual(['tickets.csv']);
  });

  it('shows a taken name inline and keeps the draft', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(409, {
        statusCode: 409,
        error: 'Conflict',
        code: 'name-taken',
        field: 'name',
        message: 'A project with this name already exists',
      }),
    );
    renderAtRoute();
    typeName('Handbook');
    await userEvent.click(screen.getByRole('button', { name: 'add file' }));

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      ProjectsI18nKeys.CreateErrorNameTaken,
    );
    expect(showNotificationMock).not.toHaveBeenCalled();
    expect(formProps.current?.values.name).toBe('Handbook');
    expect(formProps.current?.contextFiles).toHaveLength(1);
  });

  it('shows a capacity rejection under the context files', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(413, {
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'capacity-exceeded',
        message: 'too big',
      }),
    );
    renderAtRoute();
    typeName('Handbook');

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      ProjectsI18nKeys.CreateErrorFilesRejected,
    );
    expect(formProps.current?.errors.context).toBe(
      ProjectsI18nKeys.CreateErrorFilesRejected,
    );
  });

  it('shows a toast for an upstream failure and keeps the draft', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(503, { statusCode: 503, message: 'unreachable' }),
    );
    renderAtRoute();
    typeName('Handbook');

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() =>
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: ProjectsI18nKeys.CreateToastError }),
      ),
    );
    expect(formProps.current?.values.name).toBe('Handbook');
    expect(screen.queryByText('projects list')).toBeNull();
  });

  it('clears a name error once the name changes', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(409, { statusCode: 409, code: 'name-taken' }),
    );
    renderAtRoute();
    typeName('Handbook');
    await userEvent.click(screen.getByRole('button', { name: 'create' }));
    await screen.findByRole('alert');

    typeName('Handbook 2');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('context file preview', () => {
    const addFile = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'add file' }));
    };
    const getCanvas = () => screen.getByLabelText('canvas');

    it('opens an added file in the canvas from its local File, without any request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      renderAtRoute();
      await addFile();

      await userEvent.click(
        screen.getByRole('button', { name: 'Preview tickets.csv' }),
      );

      expect(getCanvas().textContent).toBe('new::file-1');
      await waitFor(() =>
        expect(previewResolvers.resolveOoxmlContent).toHaveBeenCalledOnce(),
      );
      const [opened] = previewResolvers.resolveOoxmlContent.mock
        .calls[0] as unknown as [{ file: File }];
      expect(opened.file.name).toBe('tickets.csv');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('marks only the open file selected', async () => {
      renderAtRoute();
      await addFile();
      const card = screen.getByRole('button', { name: 'Preview tickets.csv' });
      expect(card.getAttribute('aria-pressed')).toBe('false');

      await userEvent.click(card);

      await waitFor(() =>
        expect(card.getAttribute('aria-pressed')).toBe('true'),
      );
    });

    it('opens the file again when its open card is activated again, as a conversation attachment does', async () => {
      renderAtRoute();
      await addFile();
      const card = screen.getByRole('button', { name: 'Preview tickets.csv' });

      await userEvent.click(card);
      await waitFor(() =>
        expect(previewResolvers.resolveOoxmlContent).toHaveBeenCalledTimes(1),
      );
      await userEvent.click(card);

      await waitFor(() =>
        expect(previewResolvers.resolveOoxmlContent).toHaveBeenCalledTimes(2),
      );
      expect(getCanvas().textContent).toBe('new::file-1');
    });

    it('leaves the canvas open when the open file is removed from the form', async () => {
      renderAtRoute();
      await addFile();
      await userEvent.click(
        screen.getByRole('button', { name: 'Preview tickets.csv' }),
      );
      await waitFor(() => expect(getCanvas().textContent).toBe('new::file-1'));

      act(() => formProps.current?.onContextFilesChange([]));

      expect(getCanvas().textContent).toBe('new::file-1');
    });

    it('leaves the form values and files untouched when a preview opens', async () => {
      renderAtRoute();
      await addFile();
      const filesBefore = formProps.current?.contextFiles;
      const valuesBefore = formProps.current?.values;

      await userEvent.click(
        screen.getByRole('button', { name: 'Preview tickets.csv' }),
      );

      expect(formProps.current?.contextFiles).toBe(filesBefore);
      expect(formProps.current?.values).toBe(valuesBefore);
    });
  });

  describe('leave guard', () => {
    it('leaves a clean form without confirmation', async () => {
      renderAtRoute();

      await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(await screen.findByText('projects list')).toBeTruthy();
    });

    it('asks before Cancel leaves an edited form', async () => {
      const { router } = renderAtRoute();
      typeName('Draft');

      await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(
        screen.getAllByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
      ).toHaveLength(1);
      expect(router.state.location.pathname).toBe('/projects/new');
    });

    it('asks before other navigation leaves a form with only a file', async () => {
      const { router } = renderAtRoute();
      await userEvent.click(screen.getByRole('button', { name: 'add file' }));

      await act(() => router.navigate('/catalog'));

      expect(
        screen.getAllByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
      ).toHaveLength(1);
      expect(router.state.location.pathname).toBe('/projects/new');
    });
  });
});
