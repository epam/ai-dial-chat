import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { ScheduledTaskDetailsSummary } from '@epam/ai-dial-scheduled-tasks';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskModelPreview } from '../useScheduledTaskModelPreview';

const { catalog } = vi.hoisted(() => ({
  catalog: {
    items: [] as DeploymentItemDto[],
    isLoading: false,
    error: null as Error | null,
  },
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => catalog,
}));
vi.mock('../../language/useLanguage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../language/useLanguage')>()),
  useLanguage: () => ({ language: 'en' }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name: string }) =>
      key.endsWith('unavailableModelName')
        ? `${options?.name} (unavailable)`
        : 'The model or agent has been deleted or access revoked',
  }),
}));

const Preview = ({
  id = 'applications/bucket/My%20agent',
}: {
  id?: string;
}) => {
  const preview = useScheduledTaskModelPreview(id);
  return (
    <ScheduledTaskDetailsSummary
      {...preview}
      modelLabel="Model"
      instructionsLabel="Instructions"
    />
  );
};

describe('scheduled task model preview', () => {
  beforeEach(() => {
    catalog.items = [];
    catalog.isLoading = false;
    catalog.error = null;
  });

  it('waits for the catalog before showing an unavailable agent', async () => {
    catalog.isLoading = true;
    const view = render(<Preview />);
    expect(screen.queryByText('applications/bucket/My%20agent')).toBeNull();
    expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
    catalog.isLoading = false;
    view.rerender(<Preview />);
    const agent = screen.getByText('My agent (unavailable)');
    expect(agent.className).toContain('text-error');
    expect(agent.className).toContain('cursor-pointer');
    await userEvent.setup().hover(agent);
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'The model or agent has been deleted or access revoked',
    );
  });

  it('marks a removed model unavailable', () => {
    render(<Preview id="gpt-removed" />);
    expect(screen.getByText('gpt-removed (unavailable)')).toBeTruthy();
  });

  it.each(['alias', 'applications/bucket/My agent'])(
    'resolves an accessible reference %s',
    (id) => {
      catalog.items = [
        {
          id: 'applications/bucket/My%20agent',
          reference: 'alias',
          displayName: 'Available agent',
        } as DeploymentItemDto,
      ];
      render(<Preview id={id} />);
      expect(screen.getByText('Available agent')).toBeTruthy();
      expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
    },
  );

  it('does not treat a catalog failure as deletion', () => {
    catalog.error = new Error('Temporary failure');
    render(<Preview />);
    expect(screen.queryByText(/\(unavailable\)/)).toBeNull();
    expect(screen.getByText('applications/bucket/My%20agent')).toBeTruthy();
  });
});
