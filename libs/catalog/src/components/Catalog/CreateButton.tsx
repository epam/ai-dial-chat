import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DropdownItem,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { FC, useRef } from 'react';

/** Props for the catalog Create button. */
export interface CreateButtonProps {
  /** Button label. */
  label: string;
  /**
   * When provided, the button opens a dropdown with these options instead of
   * calling `onClick` directly.
   */
  options?: DropdownItem[];
  /** Called when the button is clicked and no `options` are present. */
  onClick?: () => void;
}

/** Renders either a plain primary button or a split-chevron dropdown. */
export const CreateButton: FC<CreateButtonProps> = ({
  label,
  options,
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!options?.length) {
    return (
      <PrimaryButton
        label={label}
        iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
        onClick={onClick}
      />
    );
  }

  return (
    <div ref={containerRef}>
      <ButtonDropdown
        appearance={ButtonAppearance.Solid}
        label={label}
        iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
        variant={ButtonVariant.Primary}
        items={options}
      />
    </div>
  );
};
