export interface ToggleSwitchProps {
  isOn: boolean;
  handleSwitch: () => void;
  switchOnText?: string;
  switchOFFText?: string;
  additionalText?: string;
  className?: string;
  disabled?: boolean;
  tooltip?: string;
  warning?: string;
}
