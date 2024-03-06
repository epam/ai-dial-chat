import React, { useEffect, useImperativeHandle, useRef } from 'react';

import classNames from 'classnames';

type Props = React.DetailedHTMLProps<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  HTMLTextAreaElement
>;

export const AdjustedTextarea = React.forwardRef((props: Props, ref) => {
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => mainTextareaRef.current);

  const { value, className } = props;

  useEffect(() => {
    if (hiddenTextareaRef.current && mainTextareaRef.current) {
      mainTextareaRef.current.style.height = `${hiddenTextareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <>
      <textarea
        {...props}
        ref={hiddenTextareaRef}
        name="hidden"
        className={classNames(
          className,
          'absolute left-[-1000px] top-[-1000px]',
        )}
      />
      <textarea {...props} ref={mainTextareaRef} name="main" />
    </>
  );
});

AdjustedTextarea.displayName = 'AdjustedTextarea';
