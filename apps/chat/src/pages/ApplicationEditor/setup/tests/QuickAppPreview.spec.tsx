import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsEditorI18nKeys } from '../../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../../context/DeploymentsContext';
import type { ApplicationPreviewProps } from '../../../../models/application-editor';
import QuickAppPreview from '../QuickAppPreview';

vi.mock('../AppPreviewChat', () => ({
  default: ({ appDisplayName }: { appDisplayName?: string }) => (
    <div>{`preview-chat-${appDisplayName ?? ''}`}</div>
  ),
}));
vi.mock('../../../../context/DeploymentsContext');

const SCHEMA = { id: 'schema-id', displayName: 'QuickApp' };

const METADATA: DeploymentCreationFormValues = {
  name: 'Design Review Agent',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const mockOnExit = vi.fn();

const renderPreview = (props?: Partial<ApplicationPreviewProps>) =>
  render(
    <MemoryRouter initialEntries={[`/apps-editor?schema=${SCHEMA.id}`]}>
      <QuickAppPreview
        appId="applications/bucket/app"
        metadata={METADATA}
        isVisible
        onExit={mockOnExit}
        {...props}
      />
    </MemoryRouter>,
  );

const getBackButton = () =>
  screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewBackToSetup });

describe('QuickAppPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
      schemas: [SCHEMA],
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  it('calls onExit when Back to setup is clicked', async () => {
    renderPreview();

    await userEvent.click(getBackButton());

    expect(mockOnExit).toHaveBeenCalledOnce();
  });

  it('renders a page heading and passes the Metadata name to the chat', () => {
    renderPreview();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: AppsEditorI18nKeys.PreviewBannerLabel,
      }),
    ).toBeTruthy();
    expect(screen.getByText('preview-chat-Design Review Agent')).toBeTruthy();
  });

  it('falls back to the schema display name when the Metadata name is empty', () => {
    renderPreview({ metadata: { ...METADATA, name: '' } });

    expect(screen.getByText('preview-chat-QuickApp')).toBeTruthy();
  });

  it('focuses Back to setup when the preview becomes visible', () => {
    const { rerender } = renderPreview({ isVisible: false });
    expect(getBackButton().matches(':focus')).toBe(false);

    rerender(
      <MemoryRouter initialEntries={[`/apps-editor?schema=${SCHEMA.id}`]}>
        <QuickAppPreview
          appId="applications/bucket/app"
          metadata={METADATA}
          isVisible
          onExit={mockOnExit}
        />
      </MemoryRouter>,
    );

    expect(getBackButton().matches(':focus')).toBe(true);
  });

  it('mirrors the back arrow in RTL', () => {
    renderPreview();

    /* The arrow is aria-hidden, so no accessible query reaches it; this asserts a CSS class. */
    // eslint-disable-next-line testing-library/no-node-access
    const icon = getBackButton().querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('rtl:scale-x-[-1]');
  });
});
