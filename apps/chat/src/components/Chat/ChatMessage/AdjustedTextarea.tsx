import React, { useEffect, useImperativeHandle, useRef } from 'react';

import classNames from 'classnames';

type Props = React.DetailedHTMLProps<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  HTMLTextAreaElement
> & {
  maxHeight?: number;
};

export const AdjustedTextarea = React.forwardRef((props: Props, ref) => {
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => mainTextareaRef.current); // proxy ref

  const { value, maxHeight = 10000, className, ...restProps } = props;

  useEffect(() => {
    if (hiddenTextareaRef.current && mainTextareaRef.current) {
      const scrollHeight = hiddenTextareaRef.current.scrollHeight;
      mainTextareaRef.current.style.height = `${scrollHeight}px`; // set height as scrollHeight of hidden element
      mainTextareaRef.current.style.overflowY = `${
        scrollHeight > maxHeight ? 'auto' : 'hidden' // show vertical scroll if max height was achieved
      }`;
    }
  }, [maxHeight, value]);

  useEffect(() => {
    const handleResize = () => {
      if (hiddenTextareaRef.current && mainTextareaRef.current) {
        // we should change hidden textarea width along with main textarea width
        hiddenTextareaRef.current.style.width = `${mainTextareaRef.current.clientWidth}px`;
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (mainTextareaRef.current) {
      resizeObserver.observe(mainTextareaRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <textarea
        {...restProps}
        ref={hiddenTextareaRef}
        name="hidden"
        className={classNames(
          className,
          'invisible absolute', // hidden, but exists
        )}
        data-qa="hidden-textarea"
        value={value}
      />
      <textarea
        data-qa="chat-textarea"
        className={className}
        value={value}
        {...restProps}
        ref={mainTextareaRef}
        name="main"
        style={{ maxHeight: `${maxHeight}px` }}
      />
    </>
  );
});

AdjustedTextarea.displayName = 'AdjustedTextarea';
