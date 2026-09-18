/*
 * Guard tests for this package's public `dial-*` class contract — see the
 * "Public class names" section of openspec/lib-styling-guide.md.
 *
 * A styling hook sits on an unlabeled wrapper with no accessible role or text
 * of its own, so asserting one is inherently a DOM-level check and Testing
 * Library has no semantic equivalent of "is this class on that element's
 * ancestor". Every test still locates a real element by role, label or text
 * first and only then walks to the container under test, so a class landing on
 * the wrong node fails rather than passes. Hence the rule exemption below.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_INPUT_CLASS } from '../../../constants/public-class-names';
import { AttachmentCard } from '../../AttachmentCard/AttachmentCard';
import { AttachmentTray } from '../AttachmentTray';

const makeFile = (
  id: string,
  overrides: Partial<DisplayAttachment> = {},
): DisplayAttachment => ({
  id,
  name: `${id}.pdf`,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

const makeImage = (id: string): DisplayAttachment => ({
  id,
  name: `${id}.png`,
  contentType: 'image/png',
  type: AttachmentType.Image,
  status: RequestStatus.Idle,
  previewUrl: 'blob:preview',
});

/*
 * The public classes are host styling hooks, so a test must never find an
 * element *by* the class — that would still pass with the class on the wrong
 * node. Locate by role or label first, then walk up to the container under
 * test and assert the hook is on it.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  from.closest(`.${className}`);

describe('AttachmentTray — public class names', () => {
  it('marks the tray root and one item per attachment', () => {
    const { container } = render(
      <AttachmentTray
        attachments={[makeFile('a'), makeFile('b'), makeFile('c')]}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('list', { name: 'Attached files' }).classList,
    ).toContain(ATTACHMENT_INPUT_CLASS.tray);
    expect(
      container.querySelectorAll(`.${ATTACHMENT_INPUT_CLASS.trayItem}`),
    ).toHaveLength(3);
  });

  it('keeps the tray addressable when the host localises its label', () => {
    render(
      <AttachmentTray
        attachments={[makeFile('a')]}
        labels={{ ariaLabel: 'Вложения' }}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('list', { name: 'Вложения' }).classList).toContain(
      ATTACHMENT_INPUT_CLASS.tray,
    );
  });

  it('emits nothing at all for an empty list', () => {
    const { container } = render(
      <AttachmentTray attachments={[]} onRemove={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('marks both the file tile and the image tile', () => {
    const { container } = render(
      <AttachmentTray
        attachments={[makeFile('doc'), makeImage('pic')]}
        onRemove={vi.fn()}
      />,
    );

    expect(
      container.querySelectorAll(`.${ATTACHMENT_INPUT_CLASS.tile}`),
    ).toHaveLength(2);
  });

  it('marks the tile name and type row', () => {
    render(<AttachmentTray attachments={[makeFile('doc')]} />);

    const tile = closestWithClass(
      screen.getByText('doc'),
      ATTACHMENT_INPUT_CLASS.tile,
    );

    expect(tile).toBeTruthy();
    expect(
      tile!.querySelector(`.${ATTACHMENT_INPUT_CLASS.tileName}`),
    ).toBeTruthy();
    expect(
      tile!.querySelector(`.${ATTACHMENT_INPUT_CLASS.tileType}`),
    ).toBeTruthy();
  });

  it('keeps the tile marked while the upload is in progress', () => {
    render(
      <AttachmentTray
        attachments={[makeFile('doc', { status: RequestStatus.Loading })]}
      />,
    );

    expect(
      closestWithClass(
        screen.getByRole('progressbar', { name: 'Uploading' }),
        ATTACHMENT_INPUT_CLASS.tile,
      ),
    ).toBeTruthy();
  });

  it('emits the same classes under rtl as under ltr', () => {
    const readTileClasses = (): string[] =>
      Array.from(
        closestWithClass(screen.getByText('doc'), ATTACHMENT_INPUT_CLASS.tile)!
          .classList,
      ).filter((name) => name.startsWith('dial-ai-'));

    const view = render(<AttachmentTray attachments={[makeFile('doc')]} />);
    const ltrClasses = readTileClasses();
    view.unmount();

    document.documentElement.dir = 'rtl';
    try {
      render(<AttachmentTray attachments={[makeFile('doc')]} />);
      expect(readTileClasses()).toEqual(ltrClasses);
    } finally {
      document.documentElement.dir = 'ltr';
    }
  });
});

describe('AttachmentCard — public class names', () => {
  it('adds the selected class alongside the tile class when selected', () => {
    render(<AttachmentCard attachment={makeFile('doc')} isSelected />);

    const tile = closestWithClass(
      screen.getByText('doc'),
      ATTACHMENT_INPUT_CLASS.tile,
    );

    expect(tile).toBeTruthy();
    expect(tile!.classList).toContain(ATTACHMENT_INPUT_CLASS.tileSelected);
  });

  it('omits the selected class when not selected', () => {
    render(<AttachmentCard attachment={makeFile('doc')} />);

    const tile = closestWithClass(
      screen.getByText('doc'),
      ATTACHMENT_INPUT_CLASS.tile,
    );

    expect(tile!.classList).not.toContain(ATTACHMENT_INPUT_CLASS.tileSelected);
  });

  it('marks every corner action and leaves their ARIA wiring intact', () => {
    render(
      <AttachmentCard
        attachment={makeFile('doc', {
          status: RequestStatus.Error,
          errorReason: AttachmentErrorReason.Network,
        })}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const retry = screen.getByLabelText('Retry upload');
    const remove = screen.getByLabelText('Remove attachment');

    expect(retry.classList).toContain(ATTACHMENT_INPUT_CLASS.tileAction);
    expect(remove.classList).toContain(ATTACHMENT_INPUT_CLASS.tileAction);
    expect(retry.getAttribute('aria-describedby')).toBeTruthy();
    expect(remove.getAttribute('aria-describedby')).toBeTruthy();
  });
});
