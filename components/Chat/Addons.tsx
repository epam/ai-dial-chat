import { MouseEventHandler, useState } from 'react';

import { OpenAIEntityAddon } from '@/types/openai';

interface AddonButtonProps {
  addonName: string;
  addonId: string;
  onChangeAddon: (addonId: string) => void;
  disabled?: boolean;
  isPreselected?: boolean;
}

interface AddonsProps {
  addons: OpenAIEntityAddon[];
  preselectedAddons: OpenAIEntityAddon[];
  onChangeAddon: (addonId: string) => void;
}

export const AddonButton = ({
  disabled,
  isPreselected,
  addonName,
  addonId,
  onChangeAddon,
}: AddonButtonProps) => {
  const [isSelected, setIsSelected] = useState(isPreselected);

  const onClickHandlerAddon: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (!disabled) {
      onChangeAddon(addonId);
      setIsSelected((prev) => !prev);
    }
  };
  return (
    <button
      className={`border rounded p-1 max-w-[20%] ${
        isSelected
          ? 'shadow-md shadow-[#717283] dark:border-white bg-[#717283] dark:text-white'
          : 'dark:border-#cccccc'
      } ${disabled ? 'dark:bg-[#202123] cursor-not-allowed' : ''}`}
      onClick={onClickHandlerAddon}
    >
      <span>{addonName}</span>
    </button>
  );
};
export const Addons = ({
  addons,
  onChangeAddon,
  preselectedAddons,
}: AddonsProps) => {
  return (
    <div className="flex gap-8 flex-wrap">
      {addons.map((adon) => (
        <AddonButton
          key={adon.id}
          addonName={adon.name}
          addonId={adon.id}
          onChangeAddon={onChangeAddon}
        />
      ))}
    </div>
  );
};
