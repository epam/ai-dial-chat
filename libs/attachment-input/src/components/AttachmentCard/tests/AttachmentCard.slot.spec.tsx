import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentCardProvider } from '../../../context/AttachmentCardContext';
import type { AttachmentCardProps } from '../../../models/attachment-card';
import { AttachmentGroup } from '../../AttachmentGroup/AttachmentGroup';
import { AttachmentTray } from '../../AttachmentTray/AttachmentTray';
import { AttachmentCard } from '../AttachmentCard';

const attachment: DisplayAttachment = {
  id: 'a',
  name: 'report.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
};

const HostCard: FC<AttachmentCardProps> = ({
  attachment: item,
  isSelected,
}) => (
  <div data-testid="host-card" data-selected={String(isSelected)}>
    {item.name}
  </div>
);

describe('AttachmentCard slot', () => {
  it('renders the built-in tile when no provider is mounted', () => {
    render(<AttachmentCard attachment={attachment} />);

    expect(screen.queryByTestId('host-card')).toBeNull();
    expect(screen.getByTitle('report')).toBeTruthy();
  });

  it('renders the built-in tile when the provider supplies no component', () => {
    render(
      <AttachmentCardProvider>
        <AttachmentCard attachment={attachment} />
      </AttachmentCardProvider>,
    );

    expect(screen.queryByTestId('host-card')).toBeNull();
    expect(screen.getByTitle('report')).toBeTruthy();
  });

  it('renders the host component and forwards every prop to it', () => {
    render(
      <AttachmentCardProvider component={HostCard}>
        <AttachmentCard attachment={attachment} isSelected />
      </AttachmentCardProvider>,
    );

    const card = screen.getByTestId('host-card');
    expect(card.textContent).toBe('report.pdf');
    expect(card.getAttribute('data-selected')).toBe('true');
    expect(screen.queryByTitle('report')).toBeNull();
  });

  it('forwards every prop it received to the host component unchanged', () => {
    const received = vi.fn();
    const RecordingCard: FC<AttachmentCardProps> = (props) => {
      received(props);
      return <div data-testid="host-card" />;
    };
    const props: AttachmentCardProps = {
      attachment,
      searchQuery: 'rep',
      onRemove: vi.fn(),
      onRetry: vi.fn(),
      onExpand: vi.fn(),
      onClick: vi.fn(),
      onDownload: vi.fn(),
      isSelected: true,
      labels: { removeLabel: 'Remove', clickLabel: 'Open' },
      styles: { className: 'custom' },
    };

    render(
      <AttachmentCardProvider component={RecordingCard}>
        <AttachmentCard {...props} />
      </AttachmentCardProvider>,
    );

    const forwarded = received.mock.calls[0][0] as AttachmentCardProps;
    expect(Object.keys(forwarded).sort()).toEqual(Object.keys(props).sort());
    for (const key of Object.keys(props) as (keyof AttachmentCardProps)[]) {
      expect(forwarded[key]).toBe(props[key]);
    }
  });

  it('adds no markup around the host component', () => {
    const { container: bare } = render(<HostCard attachment={attachment} />);
    const { container: slotted } = render(
      <AttachmentCardProvider component={HostCard}>
        <AttachmentCard attachment={attachment} />
      </AttachmentCardProvider>,
    );

    /* Serialised markup is the assertion; no role or text query sees a wrapper. */
    expect(slotted.innerHTML).toBe(bare.innerHTML);
  });

  it('reaches cards rendered by AttachmentTray and AttachmentGroup', () => {
    render(
      <AttachmentCardProvider component={HostCard}>
        <AttachmentTray attachments={[attachment]} />
        <AttachmentGroup attachments={[attachment]} />
      </AttachmentCardProvider>,
    );

    expect(screen.getAllByTestId('host-card')).toHaveLength(2);
  });

  it('lets a nested provider without a component restore the built-in tile', () => {
    render(
      <AttachmentCardProvider component={HostCard}>
        <AttachmentCardProvider>
          <AttachmentCard attachment={attachment} />
        </AttachmentCardProvider>
      </AttachmentCardProvider>,
    );

    expect(screen.queryByTestId('host-card')).toBeNull();
    expect(screen.getByTitle('report')).toBeTruthy();
  });
});
