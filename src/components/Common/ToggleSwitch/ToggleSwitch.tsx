import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';

export interface ToggleSwitchProps {
  isOn: boolean;
  handleSwitch: () => void;
  switchOnText?: string | null;
  switchOFFText?: string | null;
  switchOnBackgroungColor: HighlightColor;
}

interface SwitchStateTextProps {
  switchText: string;
}

const SwitchStateText = ({ switchText }: SwitchStateTextProps) => (
  <span className="h-[15px] w-6 text-xs">{switchText}</span>
);

export function ToggleSwitch({
  isOn,
  switchOnText,
  switchOFFText,
  switchOnBackgroungColor,
  handleSwitch,
}: ToggleSwitchProps) {
  const switchText = isOn ? switchOnText : switchOFFText;
  const switchOnBackground = getByHighlightColor(
    switchOnBackgroungColor,
    'bg-green dark:bg-green',
    'bg-violet dark:bg-violet',
    'bg-blue-500 dark:bg-blue-500',
  );
  const switchBackground = isOn
    ? switchOnBackground
    : 'bg-gray-400 dark:bg-gray-600';

  const switchClassName = classNames(
    'flex  min-w-[50px] shrink-0 cursor-pointer items-center  gap-1 rounded-full p-1.5 transition-all duration-200',
    switchBackground,
    isOn ? 'flex-row' : 'flex-row-reverse',
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
        {switchText && <SwitchStateText switchText={switchText} />}
        <span className="h-3 w-3 rounded-full bg-gray-100"></span>
      </div>
    </div>
  );
}
