import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { isMobile } from '@/src/utils/app/mobile';

import { OverlayActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { OverlaySelectors } from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { MessageButton, MessageButtonPlacement } from '@epam/ai-dial-shared';

interface ButtonProps {
  button: MessageButton;
  realMessageIndex: number;
  defaultClassName?: string;
  defaultIconClassName?: string;
}

export const OverlayMessageCustomButton = ({
  button,
  defaultClassName,
  defaultIconClassName,
  realMessageIndex,
}: ButtonProps) => {
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleOnButtonEvent = useCallback(
    (eventName: keyof WindowEventMap) => {
      dispatch(
        OverlayActions.sendCustomMessageEvent({
          buttonKey: button.buttonKey,
          eventName: eventName,
          messageIndex: realMessageIndex,
        }),
      );
    },
    [button.buttonKey, dispatch, realMessageIndex],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const focusIn = () => {
      setIsFocused(true);
    };
    const focusOut = () => {
      setIsFocused(false);
    };

    node.addEventListener('focusin', focusIn);
    node.addEventListener('focusout', focusOut);

    return () => {
      node.removeEventListener('focusin', focusIn);
      node.removeEventListener('focusout', focusOut);
    };
  }, []);

  useEffect(() => {
    if (!ref) return;

    const abortSignal = new AbortController();
    button.events.forEach((event) =>
      ref.current?.addEventListener(
        event,
        () => {
          handleOnButtonEvent(event);
        },
        { signal: abortSignal.signal },
      ),
    );

    return () => {
      abortSignal.abort();
    };
  }, [button.events, handleOnButtonEvent]);

  if (!button.iconSvg && !button.title) return null;

  return (
    <Tooltip tooltip={button.tooltip} placement="top" isTriggerClickable>
      <button
        ref={ref}
        disabled={button.disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={classNames(!button.skipDefaultStyles && defaultClassName)}
        style={{
          ...(button.styles as CSSProperties),
          ...(isHovered && !button.disabled
            ? (button.hoverStyles as CSSProperties)
            : undefined),
          ...(isFocused && !button.disabled
            ? (button.focusStyles as CSSProperties)
            : undefined),
          ...(button.disabled && button.disabledStyles
            ? (button.disabledStyles as CSSProperties)
            : undefined),
        }}
      >
        {button.iconSvg && (
          <span
            className={classNames(
              !button.skipDefaultStyles && defaultIconClassName,
            )}
            dangerouslySetInnerHTML={
              button.iconSvg ? { __html: button.iconSvg } : undefined
            }
          ></span>
        )}
        {button.title &&
          (button.placement !==
            MessageButtonPlacement.PREPEND_DEFAULT_BUTTONS ||
            isMobile()) && <span>{button.title}</span>}
      </button>
    </Tooltip>
  );
};

interface Props {
  realMessageIndex: number;
}

export const OverlayMessageCustomButtons = ({ realMessageIndex }: Props) => {
  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectContentAppendedButtonsForMessage(
      state,
      realMessageIndex,
    ),
  );

  if (!customMessageButtons?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {customMessageButtons.map((button) => (
        <OverlayMessageCustomButton
          key={button.buttonKey}
          button={button}
          defaultClassName="button button-secondary flex items-center gap-2 px-2 py-1"
          realMessageIndex={realMessageIndex}
        />
      ))}
    </div>
  );
};
