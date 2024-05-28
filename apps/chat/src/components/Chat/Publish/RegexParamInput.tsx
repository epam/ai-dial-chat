import { ChangeEvent, useCallback } from 'react';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
}

export function RegexParamInput({
  regEx,
  onRegExChange,
}: RegexParamInputProps) {
  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onRegExChange(e.target.value);
    },
    [onRegExChange],
  );

  return (
    <div className="rounded-primary shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary  hover:border-accent-quaternary flex w-full flex-wrap border border-secondary bg-layer-2 p-1">
      <input
        className="w-full bg-transparent py-1 pl-2 outline-none"
        type="text"
        placeholder={'Enter regular expression...'}
        value={regEx}
        onChange={handleRegExChange}
      />
    </div>
  );
}
