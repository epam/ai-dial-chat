import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import { OverlayActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { OverlaySelectors } from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { MessageButton } from '@epam/ai-dial-shared';

interface ButtonProps {
  button: MessageButton;
  onEvent: (eventName: keyof WindowEventMap) => void;
}

const MessageCustomButton = ({ button, onEvent }: ButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
          onEvent(event);
        },
        { signal: abortSignal.signal },
      ),
    );

    return () => {
      abortSignal.abort();
    };
  }, [button.events, onEvent]);

  if (!button.iconSvg && !button.title) return null;

  return (
    <Tooltip tooltip={button.tooltip}>
      <button
        ref={ref}
        disabled={button.disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={
          button.skipDefaultStyles
            ? undefined
            : 'button button-secondary flex items-center gap-2 px-2 py-1'
        }
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
            dangerouslySetInnerHTML={
              button.iconSvg ? { __html: button.iconSvg } : undefined
            }
          ></span>
        )}
        {button.title && <span>{button.title}</span>}
      </button>
    </Tooltip>
  );
};

interface Props {
  messageIndex: number;
}

export const MessageCustomButtons = ({ messageIndex }: Props) => {
  const dispatch = useAppDispatch();

  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectCustomButtonsForMessage(state, messageIndex),
  );

  const handleOnButtonEvent = useCallback(
    (
      eventName: keyof WindowEventMap,
      button: MessageButton,
      messageIndex: number,
    ) => {
      dispatch(
        OverlayActions.sendCustomMessageEvent({
          buttonKey: button.buttonKey,
          eventName: eventName,
          messageIndex,
        }),
      );
    },
    [dispatch],
  );

  if (!customMessageButtons?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {customMessageButtons.map((button) => (
        <MessageCustomButton
          key={button.buttonKey}
          button={button}
          onEvent={(eventName) =>
            handleOnButtonEvent(eventName, button, messageIndex)
          }
        />
      ))}
    </div>
  );
};
