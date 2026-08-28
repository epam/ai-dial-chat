import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type RefObject,
} from 'react';

/** Parameters for `useImportFilePicker`. */
export interface UseImportFilePickerParams {
  /**
   * MIME types / file-extension filter string passed to the hidden input's
   * `accept` attribute. The host resolves any platform-specific policy before
   * passing this value.
   */
  accept?: string;
  /** Called with the selected `File` after the user confirms their choice. */
  onFileSelected: (file: File) => void;
}

/** Controls returned by `useImportFilePicker`. */
export interface UseImportFilePickerResult {
  /** Ref to attach to the hidden `<input type="file">` element. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Programmatically opens the native file picker by clicking the hidden input. */
  triggerImport: () => void;
  /** `onChange` handler for the hidden input; calls `onFileSelected` and resets the value. */
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Manages the hidden `<input type="file">` pattern used to trigger a native
 * file-picker without a visible control.
 *
 * The host renders `<input ref={inputRef} type="file" onChange={handleFileChange} />`
 * and calls `triggerImport()` when the user initiates an import action. The
 * hook sets the `accept` attribute via a layout effect so re-selecting the
 * same file always fires `onChange` (the value is reset after each selection).
 */
export const useImportFilePicker = ({
  accept,
  onFileSelected,
}: UseImportFilePickerParams): UseImportFilePickerResult => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Keep the input's accept attribute in sync with the host-resolved value. */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (accept === undefined || accept === '') {
      el.removeAttribute('accept');
    } else {
      el.accept = accept;
    }
  }, [accept]);

  const triggerImport = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      /* Reset so selecting the same file again re-triggers onChange. */
      event.target.value = '';
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return { inputRef, triggerImport, handleFileChange };
};
