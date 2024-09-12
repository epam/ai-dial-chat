import { isSmallScreen } from '@/src/utils/app/mobile';

import { DialAIEntityModel } from '@/src/types/models';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

const DESKTOP_ICON_SIZE = 96;
const SMALL_ICON_SIZE = 56;

interface ApplicationCardProps {
  entity: DialAIEntityModel;
  onClick: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
}

export const ApplicationCard = ({
  entity,
  onClick,
  isMobile,
}: ApplicationCardProps) => {
  const iconSize =
    isMobile ?? isSmallScreen() ? SMALL_ICON_SIZE : DESKTOP_ICON_SIZE;

  return (
    <div
      onClick={() => onClick(entity)}
      className="cursor-pointer rounded border border-primary p-3 hover:border-hover active:border-accent-primary"
    >
      <div className="mb-2 flex h-[68px] items-center gap-2 overflow-hidden md:mb-3 md:h-[108px] md:gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center md:size-24">
          <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
        </div>
        <div className="flex grow flex-col justify-center overflow-hidden">
          <h2 className="truncate text-base font-semibold leading-4 text-primary md:mb-1">
            {entity.name}
          </h2>
          <p className="invisible line-clamp-2 size-0 overflow-ellipsis text-sm text-secondary md:visible md:size-auto">
            {entity.description}
          </p>
        </div>
      </div>
    </div>
  );
};
