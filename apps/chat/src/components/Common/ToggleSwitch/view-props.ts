export interface ToggleSwitchProps {
  isOn: boolean;
  handleSwitch: () => void;
  switchOnText?: string | null;
  switchOFFText?: string | null;
}
