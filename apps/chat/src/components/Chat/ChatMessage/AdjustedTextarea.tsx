import React, { useEffect, useImperativeHandle, useRef } from 'react';

import classNames from 'classnames';

type Props = React.DetailedHTMLProps<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  HTMLTextAreaElement
> & {
  maxHeight?: number;
};

export const AdjustedTextarea = React.forwardRef(
  ({ value, maxHeight = 10000, className, ...props }: Props, ref) => {
    const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);
    const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => mainTextareaRef.current); // proxy ref

    useEffect(() => {
      if (hiddenTextareaRef.current && mainTextareaRef.current) {
        hiddenTextareaRef.current.style.width = `${mainTextareaRef.current.clientWidth}px`; // adapt width (parent paddings don't work for absolute element)
        const scrollHeight = hiddenTextareaRef.current.scrollHeight;
        mainTextareaRef.current.style.height = `${scrollHeight}px`; // set height as scrollHeight of hidden element
        mainTextareaRef.current.style.overflowY = `${
          scrollHeight > maxHeight ? 'auto' : 'hidden' // show vertical scroll if max height was achieved
        }`;
      }
    }, [maxHeight, value]);

    return (
      <>
        <textarea
          {...props}
          ref={hiddenTextareaRef}
          name="hidden"
          className={classNames(
            className,
            'invisible absolute', // hidden, but exists
          )}
          data-qa="hidden-textarea"
        />
        <textarea
          data-qa="chat-textarea"
          {...props}
          ref={mainTextareaRef}
          name="main"
          style={{ maxHeight: `${maxHeight}px` }}
        />
      </>
    );
  },
);

AdjustedTextarea.displayName = 'AdjustedTextarea';
