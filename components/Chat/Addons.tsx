import { MouseEventHandler, useState } from 'react';

import { OpenAIEntityAddon, OpenAIEntityAddonID } from '@/types/openai';

interface AddonButtonProps {
  addonName: string;
  addonId: string;
  onChangeAddon: (addonId: string) => void;
  isPreselected?: boolean;
}

interface AddonsProps {
  addons: OpenAIEntityAddon[];
  preselectedAddons: OpenAIEntityAddonID[];
  onChangeAddon: (addonId: string) => void;
}

export const AddonButton = ({
  isPreselected,
  addonName,
  addonId,
  onChangeAddon,
}: AddonButtonProps) => {
  const [isSelected, setIsSelected] = useState(false);

  const onClickHandlerAddon: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (!isPreselected) {
      onChangeAddon(addonId);
      setIsSelected((prev) => !prev);
    }
  };
  return (
    <button
      className={`border rounded p-1 max-w-[20%] ${
        isSelected
          ? 'dark:border-[#0075ff] dark:text-[#0075ff]'
          : 'dark:border-#cccccc'
      } ${
        isPreselected ? 'bg-[#7f7f7f] border-[#c7c8cb] cursor-not-allowed' : ''
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
}: AddonsProps) => {
  return (
    <div>
      <div
        className={`dark:bg- flex gap-8 flex-wrap overflow-auto max-h-[10vh]`}
      >
        {addons.map((adon) => {
          const isPreselected = preselectedAddons.some((id) => id === adon.id);
          return (
            <AddonButton
              key={adon.id}
              addonName={adon.name}
              addonId={adon.id}
              onChangeAddon={onChangeAddon}
              isPreselected={isPreselected}
            />
          );
        })}
      </div>
    </div>
  );
};
