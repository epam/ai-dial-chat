export interface ToggleSwitchProps {
  isOn: boolean;
  handleSwitch: () => void;
  switchOnText?: string | null;
  switchOFFText?: string | null;
  additionalText?: string | null;
  className?: string;
  disabled?: boolean;
  tooltip?: string;
}
