import { MouseEventHandler, useEffect, useState } from 'react';

import { OpenAIEntityAddon, OpenAIEntityAddonID } from '@/types/openai';

interface AddonButtonProps {
  addonName: string;
  addonId: string;
  onChangeAddon: (addonId: string) => void;
  isPreselected?: boolean;
  isAddonSelected?: boolean;
}

interface AddonsProps {
  addons: OpenAIEntityAddon[];
  preselectedAddons: OpenAIEntityAddonID[];
  selectedAddons: string[];
  onChangeAddon: (addonId: string) => void;
}

export const AddonButton = ({
  isPreselected,
  isAddonSelected,
  addonName,
  addonId,
  onChangeAddon,
}: AddonButtonProps) => {
  const [isSelected, setIsSelected] = useState(isAddonSelected);

  const onClickHandlerAddon: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (!isPreselected) {
      onChangeAddon(addonId);
      setIsSelected((prev) => !prev);
    }
  };
  useEffect(() => {
    if (isAddonSelected) {
      setIsSelected(true);
    }
  }, [isAddonSelected]);
  return (
    <button
      className={`min-h-[80px]  rounded border-2  p-1 text-neutral-600 dark:text-white ${
        isSelected ? 'border-2 border-[#0075ff]' : 'dark:border-neutral-300'
      } ${
        isPreselected
          ? 'cursor-not-allowed border-2 border-[#0075ff] bg-[#7f7f7f] text-white'
          : ''
      }`}
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
  selectedAddons,
}: AddonsProps) => {
  return (
    <div>
      <div
        className={`grid max-h-[80px] grid-cols-2 gap-8 overflow-auto sm:grid-cols-4`}
        data-qa="addons"
      >
        {addons.map((addon) => {
          const isPreselected = preselectedAddons.some((id) => id === addon.id);
          const isSelected = selectedAddons.some((id) => id === addon.id);
          return (
            <AddonButton
              key={addon.id}
              addonName={addon.name}
              addonId={addon.id}
              onChangeAddon={onChangeAddon}
              isPreselected={isPreselected}
              isAddonSelected={isSelected}
            />
          );
        })}
      </div>
    </div>
  );
};
