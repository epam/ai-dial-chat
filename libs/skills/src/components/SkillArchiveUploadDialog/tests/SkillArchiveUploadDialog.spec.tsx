import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SkillArchiveUploadDialogProps } from '../../../models/skill-archive-upload-dialog-props';
import { SkillArchiveUploadDialog } from '../SkillArchiveUploadDialog';

const renderDialog = (props?: Partial<SkillArchiveUploadDialogProps>) =>
  render(
    <SkillArchiveUploadDialog
      isOpen
      onClose={vi.fn()}
      onFilesSelected={vi.fn()}
      onFilesRejected={vi.fn()}
      {...props}
    />,
  );

const getFileInput = (ariaLabel: string): HTMLInputElement =>
  screen.getByLabelText(ariaLabel) as HTMLInputElement;

describe('SkillArchiveUploadDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('Upload skill')).toBeNull();
  });

  it('renders default English labels, the drop zone and the supported formats', () => {
    renderDialog();

    expect(screen.getByText('Upload skill')).toBeTruthy();
    expect(
      screen.getByText('Drag and drop it or click here to upload'),
    ).toBeTruthy();
    expect(screen.getByText('File formats .zip and SKILL.md')).toBeTruthy();
    expect(
      screen.getByLabelText('Upload a skill ZIP archive or a SKILL.md file'),
    ).toBeTruthy();
  });

  it('renders host-supplied labels instead of the defaults', () => {
    renderDialog({
      labels: {
        dialogTitle: 'Charger une compétence',
        dropZoneLabel: 'Déposez le fichier ici',
        formatsLabel: 'Formats acceptés : .zip et SKILL.md',
        fileInputAriaLabel: 'Charger une archive ZIP ou un fichier SKILL.md',
        closeAriaLabel: 'Fermer',
      },
    });

    expect(screen.getByText('Charger une compétence')).toBeTruthy();
    expect(screen.getByText('Déposez le fichier ici')).toBeTruthy();
    expect(
      screen.getByText('Formats acceptés : .zip et SKILL.md'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
  });

  it('limits the file picker to the default accept value', () => {
    renderDialog();

    expect(
      getFileInput('Upload a skill ZIP archive or a SKILL.md file').accept,
    ).toBe('.zip,.md');
  });

  it('forwards a host-supplied accept value', () => {
    renderDialog({ accept: '.zip' });

    expect(
      getFileInput('Upload a skill ZIP archive or a SKILL.md file').accept,
    ).toBe('.zip');
  });

  it('reports the picked file instead of uploading on open', () => {
    const onFilesSelected = vi.fn();
    renderDialog({ onFilesSelected });
    const file = new File(['zip bytes'], 'skill.zip');

    fireEvent.change(
      getFileInput('Upload a skill ZIP archive or a SKILL.md file'),
      { target: { files: [file] } },
    );

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('renders the rejection message under the drop zone accessibly', () => {
    renderDialog({ errorText: 'Please select a supported file.' });

    expect(screen.getByText('Please select a supported file.')).toBeTruthy();
  });

  it('closes on the close button click', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape, restoring focus handling to the host', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('renders under an RTL ancestor with the same labels and behavior', async () => {
    const onClose = vi.fn();
    render(
      <div dir="rtl">
        <SkillArchiveUploadDialog
          isOpen
          onClose={onClose}
          onFilesSelected={vi.fn()}
          onFilesRejected={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText('Upload skill')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
