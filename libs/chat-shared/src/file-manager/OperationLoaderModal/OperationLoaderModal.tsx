import { Popup, NeutralButton, Spinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

/** Props for the operation-in-progress overlay modal (copy/move spinner). */
export interface OperationLoaderModalProps {
  /** Title shown above the spinner (e.g. "Copying files"). */
  title: string;
  /** Secondary text below the title (e.g. "Copying 2 items"). */
  text: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  /** Called when the user clicks Cancel. */
  onCancel: () => void;
}

/** Modal overlay with a spinner and cancel button for long-running file operations. */
export const OperationLoaderModal: FC<OperationLoaderModalProps> = ({
  title,
  text,
  cancelLabel,
  onCancel,
}) => (
  <Popup
    className="!h-fit !max-h-full !w-[400px]"
    open
    closeOnOutsideClick={false}
    hideClose
    onClose={onCancel}
    footer={
      <div className="flex justify-end gap-2 px-6 py-4">
        <NeutralButton label={cancelLabel} onClick={onCancel} />
      </div>
    }
  >
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-4 px-6 py-4 text-center"
    >
      <Spinner size={32} fullWidth={false} ariaLabel={title} />
      <div className="flex flex-col gap-1">
        <div>{title}</div>
        <div className="dial-small-text text-secondary">{text}</div>
      </div>
    </div>
  </Popup>
);

export default memo(OperationLoaderModal);
