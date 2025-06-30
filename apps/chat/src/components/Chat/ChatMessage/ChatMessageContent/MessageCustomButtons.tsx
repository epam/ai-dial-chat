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
  const [isHover, setIsHover] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHover(true);
  }, []);
  const handleMouseLeave = useCallback(() => {
    setIsHover(false);
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
            : 'button button-secondary flex items-center gap-2'
        }
        style={{
          ...(button.styles as CSSProperties),
          ...(isHover ? (button.hoverStyles as CSSProperties) : undefined),
        }}
      >
        <span
          dangerouslySetInnerHTML={
            button.iconSvg ? { __html: button.iconSvg } : undefined
          }
        ></span>
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
