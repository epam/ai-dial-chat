import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishPanel } from '../PublishPanel';

const NOTE = 'Credentials are not shared by a direct save.';

const renderDirectPanel = () =>
  render(
    <div dir="rtl">
      <PublishPanel
        resource={{ title: 'Helper' }}
        folderItems={[]}
        selectedFolderPath={['Delivery']}
        onChangeFolderClick={vi.fn()}
        onPendingFolderPathChange={vi.fn()}
        onCreateFolder={vi.fn()}
        hasExistingPublicationInFolder={false}
        hasWriteAccess
        isSubmitting={false}
        isDirectWrite
        labels={{ directWriteNote: NOTE }}
      />
    </div>,
  );

/* jsdom does not resolve `direction` from `dir`, so this checks the markup is direction-neutral; the rendered mirroring is not covered here. */
describe('PublishPanel direct-write note direction neutrality', () => {
  it('is a plain text paragraph that follows the inherited direction', () => {
    renderDirectPanel();

    const note = screen.getByText(NOTE);
    expect(note.tagName).toBe('P');
    expect(note.getAttribute('dir')).toBeNull();
    expect(note.getAttribute('aria-hidden')).toBeNull();
  });

  it('uses no physical-direction utility classes', () => {
    renderDirectPanel();

    const classes = screen.getByText(NOTE).className;
    expect(classes).not.toMatch(
      /(^|\s)(ml|mr|pl|pr|left|right|text-left|text-right)-/,
    );
  });

  it('comes after the destination row in reading order', () => {
    renderDirectPanel();

    const destination = screen.getByRole('group', {
      name: 'Destination folder',
    });
    const note = screen.getByText(NOTE);
    expect(
      destination.compareDocumentPosition(note) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
