import { ChangeEvent, useCallback } from 'react';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
  readonly?: boolean;
}

export function RegexParamInput({
  regEx,
  onRegExChange,
  readonly,
}: RegexParamInputProps) {
  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onRegExChange(e.target.value);
    },
    [onRegExChange],
  );

  return (
    <div className="flex w-full flex-wrap rounded-primary  border border-secondary bg-layer-2 p-1 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary">
      <input
        className="w-full bg-transparent py-1 pl-2 outline-none"
        type="text"
        placeholder={'Enter regular expression...'}
        value={regEx}
        disabled={readonly}
        onChange={handleRegExChange}
      />
    </div>
  );
}
