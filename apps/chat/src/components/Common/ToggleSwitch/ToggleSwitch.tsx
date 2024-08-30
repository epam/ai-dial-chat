import classNames from 'classnames';

export interface ToggleSwitchProps {
  isOn: boolean;
  handleSwitch: () => void;
  switchOnText?: string | null;
  switchOFFText?: string | null;
}

interface SwitchStateTextProps {
  switchText: string;
  isOn: boolean;
}

const SwitchStateText = ({ switchText, isOn }: SwitchStateTextProps) => (
  <span
    className={classNames(
      'w-6 text-xs text-primary-bg-dark',
      isOn && 'text-controls-permanent',
    )}
  >
    {switchText}
  </span>
);

export function ToggleSwitch({
  isOn,
  switchOnText,
  switchOFFText,
  handleSwitch,
}: ToggleSwitchProps) {
  const switchText = isOn ? switchOnText : switchOFFText;
  const switchClassName = classNames(
    'flex h-[22px] w-[45px] shrink-0 cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 transition-all duration-200',
    isOn ? 'flex-row-reverse bg-pr-primary-500' : 'flex-row bg-pr-grey-300',
  );

  return (
    <div data-qa="toggle-switch">
      <input
        type="checkbox"
        onChange={handleSwitch}
        id="toggle"
        className="sr-only"
        checked={isOn}
      />
      <label htmlFor="toggle" className={switchClassName}>
        {switchText && <SwitchStateText switchText={switchText} isOn={isOn} />}
        <span className="size-4 rounded-full bg-pr-grey-white"></span>
      </label>
    </div>
  );
}
