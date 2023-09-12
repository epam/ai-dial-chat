import { Dispatch, RefObject, SetStateAction } from 'react';

export const onChangeHandler = (
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  setValue: Dispatch<SetStateAction<string>>,
) => {
  if (ref && ref.current) {
    setValue(ref.current.value);
  }
};
