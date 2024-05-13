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
    <div className="flex w-full flex-wrap rounded border border-primary p-1 focus-within:border-accent-primary">
      <input
        className="w-full bg-transparent py-1 pl-2 outline-none placeholder:text-secondary-bg-dark"
        type="text"
        placeholder={'Enter regular expression...'}
        value={regEx}
        onChange={handleRegExChange}
      />
    </div>
  );
}
