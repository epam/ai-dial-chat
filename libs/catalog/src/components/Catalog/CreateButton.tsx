import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { FC } from 'react';
import type { CreateOption } from '../../models/catalog-props';

/** Props for the catalog Create button. */
export interface CreateButtonProps {
  /** Button label. */
  label: string;
  /**
   * When provided, the button opens a dropdown with these options instead of
   * calling `onClick` directly.
   */
  options?: CreateOption[];
  /** Called when the button is clicked and no `options` are present. */
  onClick?: () => void;
}

/** Renders either a plain primary button or a split dropdown based on `options`. */
export const CreateButton: FC<CreateButtonProps> = ({
  label,
  options,
  onClick,
}) => {
  if (options?.length) {
    return (
      <DialDropdown
        items={options.map((opt, i) => ({
          key: String(i),
          label: opt.label,
          onClick: () => opt.onClick(),
        }))}
      >
        <DialPrimaryButton
          label={label}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
          iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} />}
        />
      </DialDropdown>
    );
  }

  return (
    <DialPrimaryButton
      label={label}
      iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
      onClick={onClick}
    />
  );
};
