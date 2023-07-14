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
      className={`border border-2  text-neutral-600 dark:text-white  rounded p-1 max-w-[20%] ${
        isSelected ? 'border-[#0075ff] border-2' : 'dark:border-neutral-300'
      } ${
        isPreselected
          ? 'bg-[#7f7f7f] text-white cursor-not-allowed border-[#0075ff] border-2'
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
        className={`dark:bg- flex gap-8 flex-wrap overflow-auto max-h-[10vh]`}
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
