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
   * When `true`, the native file picker opens without an `accept` filter so
   * iOS can show all files (iOS ignores `accept` inconsistently). When
   * `false`, `accept` is applied to the hidden input.
   */
  isMobile: boolean;
  /**
   * MIME types / file-extension filter string passed to the hidden input's
   * `accept` attribute when `isMobile` is `false`.
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
  isMobile,
  accept,
  onFileSelected,
}: UseImportFilePickerParams): UseImportFilePickerResult => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Keep the input's accept attribute in sync with isMobile / accept. */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (isMobile) {
      el.removeAttribute('accept');
    } else {
      el.accept = accept ?? '';
    }
  }, [isMobile, accept]);

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
