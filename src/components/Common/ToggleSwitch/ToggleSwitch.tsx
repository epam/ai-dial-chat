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
      'h-[15px] w-6 text-xs',
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
    'flex min-w-[50px] shrink-0 cursor-pointer items-center gap-1 rounded-full p-1.5 transition-all duration-200',
    isOn ? 'flex-row bg-accent-primary' : 'flex-row-reverse bg-layer-4',
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

      <div className={switchClassName}>
        {switchText && <SwitchStateText switchText={switchText} isOn={isOn} />}
        <span className="h-3 w-3 rounded-full bg-controls-permanent"></span>
      </div>
    </div>
  );
}
