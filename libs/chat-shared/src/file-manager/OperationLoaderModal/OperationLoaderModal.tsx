import { Popup, Spinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import type { OperationLoaderModalColors } from '../shell-styles';
import styles from './OperationLoaderModal.module.scss';

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
  /** Color overrides applied as CSS custom properties. */
  colors?: OperationLoaderModalColors;
  /** Typography class of the secondary text. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/** Modal overlay with a spinner and cancel button for long-running file operations. */
export const OperationLoaderModal: FC<OperationLoaderModalProps> = ({
  title,
  text,
  cancelLabel,
  onCancel,
  colors,
  textClassName = 'dial-small-text',
}) => (
  <Popup
    className="h-fit! max-h-full! w-[400px]!"
    open
    closeOnOutsideClick={false}
    hideClose
    onClose={onCancel}
    overlayStyle={buildCssVars({ '--olm-text': colors?.text })}
    mainButtons={[{ label: cancelLabel, onClick: onCancel }]}
  >
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-4 px-6 py-4 text-center"
    >
      <Spinner size={32} fullWidth={false} ariaLabel={title} />
      <div className="flex flex-col gap-1">
        <div>{title}</div>
        <div className={mergeClasses(textClassName, styles.text)}>
          {text}
        </div>
      </div>
    </div>
  </Popup>
);

export default memo(OperationLoaderModal);
