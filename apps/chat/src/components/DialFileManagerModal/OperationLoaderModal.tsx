import { DialPopup, NeutralButton,DialSpinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

interface Props {
  title: string;
  text: string;
  cancelLabel: string;
  onCancel: () => void;
}

const OperationLoaderModal: FC<Props> = ({
  title,
  text,
  cancelLabel,
  onCancel,
}) => (
  <DialPopup
    className="!h-fit !max-h-full !w-[400px]"
    open
    dividers={false}
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
      <DialSpinner size={32} fullWidth={false} ariaLabel={title} />
      <div className="flex flex-col gap-1">
        <div>{title}</div>
        <div className="text-sm text-secondary">{text}</div>
      </div>
    </div>
  </DialPopup>
);

export default memo(OperationLoaderModal);
