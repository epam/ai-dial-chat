import { CloseButton, ElementSize, mergeClasses } from '@epam/ai-dial-ui-kit';
import {
  useId,
  type FC,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { ONBOARDING_TOUR_CLASS } from '../../constants/public-class-names';
import styles from './HintCard.module.scss';

/** Props for the internal `HintCard` component. */
interface HintCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ref of the card element. */
  ref?: Ref<HTMLDivElement>;
  /** Card heading; also the dialog's accessible name. */
  heading: string;
  /** Optional body text; also the dialog's accessible description. */
  description?: string;
  /** Optional line above the heading, such as a step counter. */
  counter?: string;
  /** Accessible label of the close button; the button renders only together with `onClose`. */
  closeLabel?: string;
  /** Called when the close button is pressed. */
  onClose?: () => void;
  /** Buttons at the bottom of the card. */
  footer: ReactNode;
  /** Typography class of the counter. */
  counterClassName?: string;
  /** Typography class of the heading. */
  titleClassName: string;
  /** Typography class of the description. */
  descriptionClassName: string;
}

/** The hint card shared by the tour and the beacons: heading, description and footer buttons in a `role="dialog"`. */
export const HintCard: FC<HintCardProps> = ({
  ref,
  heading,
  description,
  counter,
  closeLabel,
  onClose,
  footer,
  counterClassName,
  titleClassName,
  descriptionClassName,
  className,
  ...rest
}) => {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      {...rest}
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      className={mergeClasses(
        ONBOARDING_TOUR_CLASS.card,
        styles.card,
        'flex flex-col gap-3 rounded-lg border p-4 outline-none',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {counter && (
            <span className={mergeClasses(styles.counter, counterClassName)}>
              {counter}
            </span>
          )}
          <h2
            id={titleId}
            className={mergeClasses(styles.title, titleClassName)}
          >
            {heading}
          </h2>
        </div>
        {onClose && closeLabel && (
          <CloseButton
            ariaLabel={closeLabel}
            size={ElementSize.Standard}
            onClose={onClose}
          />
        )}
      </div>
      {description && (
        <p
          id={descriptionId}
          className={mergeClasses(styles.description, descriptionClassName)}
        >
          {description}
        </p>
      )}
      {footer}
    </div>
  );
};
