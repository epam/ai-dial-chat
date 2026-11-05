import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PinnedProjectActionState } from '../../../models/pinned-project-action';
import { deleteProject } from '../../../server-api/projects.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { PinnedProjectActionKind } from '../../../types/pinned-project-action';
import { ROUTES } from '../../../types/routes';
import PinnedProjectActionOverlays from '../PinnedProjectActionOverlays';

const P = 'projects/bucket/support';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showErrorNotification: vi.fn(),
  notifyOperationSuccess: vi.fn(),
  replacePinnedProjectId: vi.fn(),
}));

vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }));
const translation = vi.hoisted(() => ({
  t: (key: string, options?: { name?: string }) =>
    options?.name ? `${key}:${options.name}` : key,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
  Trans: ({ i18nKey }: { i18nKey?: string }) => i18nKey ?? null,
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: mocks.showErrorNotification,
  }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mocks.notifyOperationSuccess,
  }),
}));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    pinnedProjectIds: [P],
    setPinnedProject: vi.fn(),
    replacePinnedProjectId: mocks.replacePinnedProjectId,
  }),
}));
vi.mock('../../../server-api/projects.api', () => ({
  deleteProject: vi.fn(),
  downloadProjectArchive: vi.fn(),
}));
vi.mock('../../../hooks/useDeleteConfirmationLabels', () => ({
  useDeleteConfirmationLabels: () => ({}),
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  DeleteConfirmationDrawer: ({
    open,
    title,
    message,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    title: string;
    message: ReactNode;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));
vi.mock('../../ProjectShareOverlay/ProjectShareOverlay', () => ({
  default: ({
    projectId,
    onClose,
  }: {
    projectId: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="share project">
      <span>{projectId}</span>
      <button onClick={onClose}>Close share</button>
    </div>
  ),
}));
vi.mock(
  '../../PublishProjectPanelContainer/PublishProjectPanelContainer',
  () => ({
    default: ({
      isOpen,
      projectId,
      returnFocusRef,
    }: {
      isOpen: boolean;
      projectId: string;
      returnFocusRef?: { current: HTMLElement | null };
    }) => (
      <div role="dialog" aria-label="publish project" data-open={isOpen}>
        <span>{projectId}</span>
        <span>{returnFocusRef?.current?.getAttribute('aria-label')}</span>
      </div>
    ),
  }),
);

const project: ProjectDetailsDto = {
  id: P,
  name: 'Support',
  bucket: 'bucket',
  path: 'support',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"a1"',
  contentVersion: '"cv1"',
  conversationCount: 3,
  canEdit: true,
  canManage: true,
};

const open = (kind: PinnedProjectActionKind): PinnedProjectActionState => ({
  kind,
  projectId: P,
  isOpen: true,
});

describe('PinnedProjectActionOverlays', () => {
  const trigger = document.createElement('button');
  trigger.setAttribute('aria-label', 'buttons.moreActions');

  const renderOverlays = (
    props: Partial<Parameters<typeof PinnedProjectActionOverlays>[0]> = {},
  ) => {
    const onClose = vi.fn();
    const onProjectChanged = vi.fn();
    const view = render(
      <PinnedProjectActionOverlays
        action={null}
        project={project}
        returnFocusRef={{ current: trigger }}
        onClose={onClose}
        onProjectChanged={onProjectChanged}
        {...props}
      />,
    );
    return { ...view, onClose, onProjectChanged };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing without an action', () => {
    renderOverlays();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the share popover for the project', async () => {
    const { onClose } = renderOverlays({
      action: open(PinnedProjectActionKind.Share),
    });

    expect(screen.getByRole('dialog', { name: 'share project' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Close share' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens the publish panel and returns focus to the row trigger', () => {
    renderOverlays({ action: open(PinnedProjectActionKind.Publish) });

    const panel = screen.getByRole('dialog', { name: 'publish project' });
    expect(panel.getAttribute('data-open')).toBe('true');
    expect(screen.getByText('buttons.moreActions')).toBeTruthy();
  });

  it('does not mount the publish panel for a caller who does not manage the project', () => {
    renderOverlays({
      action: open(PinnedProjectActionKind.Publish),
      project: { ...project, canManage: false },
    });

    expect(
      screen.queryByRole('dialog', { name: 'publish project' }),
    ).toBeNull();
  });

  it('keeps the publish panel mounted while it slides out', () => {
    renderOverlays({
      action: { ...open(PinnedProjectActionKind.Publish), isOpen: false },
    });

    expect(
      screen
        .getByRole('dialog', { name: 'publish project' })
        .getAttribute('data-open'),
    ).toBe('false');
  });

  it('confirms a delete with the project view page copy', () => {
    renderOverlays({ action: open(PinnedProjectActionKind.Delete) });

    expect(
      screen.getByRole('dialog', {
        name: 'buttons.delete',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('catalog.details.delete.confirmMessage'),
    ).toBeTruthy();
  });

  it('keeps the route after a delete from another page', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    const { onClose } = renderOverlays({
      action: open(PinnedProjectActionKind.Delete),
      routeProjectId: undefined,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(deleteProject).toHaveBeenCalledWith(P, '"cv1"');
    expect(mocks.notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Project,
      EntityOperation.Deleted,
      { name: 'Support' },
    );
    expect(mocks.replacePinnedProjectId).toHaveBeenCalledWith(P, null);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('leaves for the Projects list after deleting the project the route shows', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    renderOverlays({
      action: open(PinnedProjectActionKind.Delete),
      routeProjectId: P,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    );

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.Projects, {
        replace: true,
      }),
    );
  });

  it('refreshes the project and closes after a conflicting delete', async () => {
    vi.mocked(deleteProject).mockRejectedValue(
      new ResponseError(
        new Response(JSON.stringify({ code: 'project-changed' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { onClose, onProjectChanged } = renderOverlays({
      action: open(PinnedProjectActionKind.Delete),
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    );

    await waitFor(() => expect(onProjectChanged).toHaveBeenCalledWith(P));
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'projects.errors.changedElsewhere',
      }),
    );
  });

  it('ends the action when the delete is cancelled', async () => {
    const { onClose } = renderOverlays({
      action: open(PinnedProjectActionKind.Delete),
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel delete' }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('ends an open action whose project left the tree', () => {
    const { onClose } = renderOverlays({
      action: open(PinnedProjectActionKind.Delete),
      project: null,
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
