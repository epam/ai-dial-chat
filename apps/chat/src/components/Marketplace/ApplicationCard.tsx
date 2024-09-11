import { isSmallScreen } from '@/src/utils/app/mobile';

import { DialAIEntity } from '@/src/types/models';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

const DESKTOP_ICON_SIZE = 96;
const TABLET_ICON_SIZE = 56;

interface ApplicationCardProps {
  entity: DialAIEntity;
}

export const ApplicationCard = ({ entity }: ApplicationCardProps) => {
  const isTablet = isSmallScreen();

  return (
    <div className="cursor-pointer rounded border border-primary p-3 hover:border-hover active:border-accent-primary">
      <div className="mb-2 flex h-[68px] items-center gap-[5px] overflow-hidden md:mb-3 md:h-[108px] md:gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center md:size-24">
          <ModelIcon
            entityId={entity.id}
            entity={entity}
            size={isTablet ? TABLET_ICON_SIZE : DESKTOP_ICON_SIZE}
          />
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

      <p className="line-clamp-2 overflow-ellipsis text-xs text-secondary md:hidden">
        {entity.description}
      </p>
    </div>
  );
};
