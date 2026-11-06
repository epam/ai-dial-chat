import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type UnpublishConfirmationPayload,
  useUnpublishConfirmation,
} from '../useUnpublishConfirmation';

type Payload = UnpublishConfirmationPayload & { id: string };

const renderConfirmation = (
  runUnpublish = vi.fn<(payload: Payload, folderPath: string) => Promise<void>>(
    () => Promise.resolve(),
  ),
) => {
  const view = renderHook(() => useUnpublishConfirmation(runUnpublish));
  return { ...view, runUnpublish };
};

const SINGLE: Payload = { id: 'p1', name: 'Sales', folders: ['Org/Data'] };
const SEVERAL: Payload = {
  id: 'p1',
  name: 'Sales',
  folders: ['Org/Data', 'Org/Sales'],
};

describe('useUnpublishConfirmation', () => {
  it('starts closed with no entity', () => {
    const { result } = renderConfirmation();

    expect(result.current.pending).toBeNull();
    expect(result.current.dialog).toMatchObject({
      isOpen: false,
      name: '',
      folders: [],
      selectedFolder: null,
      isLoading: false,
    });
  });

  it('opens for the payload with no folder picked', () => {
    const { result } = renderConfirmation();

    act(() => result.current.dialog.onSelectedFolderChange('Org/Data'));
    act(() => result.current.open(SEVERAL));

    expect(result.current.pending).toBe(SEVERAL);
    expect(result.current.dialog).toMatchObject({
      isOpen: true,
      name: 'Sales',
      folders: SEVERAL.folders,
      selectedFolder: null,
    });
  });

  it('confirms the only folder without a pick, then closes', async () => {
    const { result, runUnpublish } = renderConfirmation();

    act(() => result.current.open(SINGLE));
    await act(() => result.current.dialog.onConfirm());

    expect(runUnpublish).toHaveBeenCalledWith(SINGLE, 'Org/Data');
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('sends the public root folder, which is the empty path', async () => {
    const { result, runUnpublish } = renderConfirmation();

    act(() => result.current.open({ ...SINGLE, folders: [''] }));
    await act(() => result.current.dialog.onConfirm());

    expect(runUnpublish).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      '',
    );
  });

  it('confirms the picked folder and clears the pick', async () => {
    const { result, runUnpublish } = renderConfirmation();

    act(() => result.current.open(SEVERAL));
    act(() => result.current.dialog.onSelectedFolderChange('Org/Sales'));
    await act(() => result.current.dialog.onConfirm());

    expect(runUnpublish).toHaveBeenCalledWith(SEVERAL, 'Org/Sales');
    expect(result.current.dialog.selectedFolder).toBeNull();
  });

  it('sends nothing when the picked folder is not among the folders', async () => {
    const { result, runUnpublish } = renderConfirmation();

    act(() => result.current.open(SEVERAL));
    act(() => result.current.dialog.onSelectedFolderChange('Org/Gone'));
    await act(() => result.current.dialog.onConfirm());

    expect(runUnpublish).not.toHaveBeenCalled();
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('keeps the dialog open while the request runs and ignores close', async () => {
    let resolveRun: () => void = () => undefined;
    const { result } = renderConfirmation(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRun = resolve;
          }),
      ),
    );

    act(() => result.current.open(SINGLE));
    let confirming: Promise<void> = Promise.resolve();
    act(() => {
      confirming = result.current.dialog.onConfirm();
    });

    expect(result.current.dialog.isLoading).toBe(true);
    act(() => result.current.dialog.onClose());
    expect(result.current.dialog.isOpen).toBe(true);

    await act(async () => {
      resolveRun();
      await confirming;
    });
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('keeps the dialog open when the request rejects', async () => {
    const { result } = renderConfirmation(
      vi.fn(() => Promise.reject(new Error('Forbidden'))),
    );

    act(() => result.current.open(SINGLE));
    await act(() => result.current.dialog.onConfirm());

    expect(result.current.dialog).toMatchObject({
      isOpen: true,
      isLoading: false,
    });
  });

  it('closes and clears the pick from Cancel', () => {
    const { result } = renderConfirmation();

    act(() => result.current.open(SEVERAL));
    act(() => result.current.dialog.onSelectedFolderChange('Org/Data'));
    act(() => result.current.dialog.onClose());

    expect(result.current.dialog).toMatchObject({
      isOpen: false,
      selectedFolder: null,
    });
  });
});
