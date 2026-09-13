import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SKILL_ARCHIVE_ACCEPT } from '../../../constants/skills';
import {
  ButtonsI18nKeys,
  SkillArchiveImportI18nKeys,
} from '../../../constants/translation-keys';
import SkillArchiveUploadDialog from '../SkillArchiveUploadDialog';

const renderDialog = (
  props?: Partial<React.ComponentProps<typeof SkillArchiveUploadDialog>>,
) =>
  render(
    <SkillArchiveUploadDialog
      isOpen
      onClose={vi.fn()}
      onFilesSelected={vi.fn()}
      onFilesRejected={vi.fn()}
      {...props}
    />,
  );

const getFileInput = (): HTMLInputElement =>
  screen.getByLabelText(
    SkillArchiveImportI18nKeys.FileInputAriaLabel,
  ) as HTMLInputElement;

describe('SkillArchiveUploadDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(
      screen.queryByText(SkillArchiveImportI18nKeys.DialogTitle),
    ).toBeNull();
  });

  it('renders the title, the drop zone and the supported formats', () => {
    renderDialog();

    expect(
      screen.getByText(SkillArchiveImportI18nKeys.DialogTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(SkillArchiveImportI18nKeys.DialogDropZoneLabel),
    ).toBeTruthy();
    expect(
      screen.getByText(SkillArchiveImportI18nKeys.DialogFormats),
    ).toBeTruthy();
  });

  it('limits the file picker to the formats the import endpoint accepts', () => {
    renderDialog();

    expect(getFileInput().accept).toBe(SKILL_ARCHIVE_ACCEPT);
  });

  it('reports the picked file instead of uploading on open', () => {
    const onFilesSelected = vi.fn();
    renderDialog({ onFilesSelected });
    const file = new File(['zip bytes'], 'skill.zip');

    fireEvent.change(getFileInput(), { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('renders the rejection message under the drop zone', () => {
    renderDialog({
      errorText: SkillArchiveImportI18nKeys.ErrorUnsupportedFilename,
    });

    expect(
      screen.getByText(SkillArchiveImportI18nKeys.ErrorUnsupportedFilename),
    ).toBeTruthy();
  });

  it('closes on the close button', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Close }),
    );

    expect(onClose).toHaveBeenCalled();
  });
});
