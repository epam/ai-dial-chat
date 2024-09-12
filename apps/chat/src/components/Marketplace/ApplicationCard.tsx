import classnames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { DialAIEntityModel } from '@/src/types/models';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ApplicationTag } from '@/src/components/Marketplace/ApplicationTag';

const DESKTOP_ICON_SIZE = 96;
const SMALL_ICON_SIZE = 56;

export const Divider = () => <div className="my-3 border border-secondary" />;

export const CardFooter = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span>

      <div className="flex gap-2 overflow-hidden">
        <ApplicationTag tag="Development" />
        <ApplicationTag tag="SDLC" />
        <ApplicationTag tag="SQL" />
      </div>
    </div>
  );
};

interface ApplicationCardProps {
  entity: DialAIEntityModel;
  onClick: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
  selected?: boolean;
}

export const ApplicationCard = ({
  entity,
  onClick,
  isMobile,
  selected,
}: ApplicationCardProps) => {
  const iconSize =
    isMobile ?? isSmallScreen() ? SMALL_ICON_SIZE : DESKTOP_ICON_SIZE;

  return (
    <div
      onClick={() => onClick(entity)}
      className={classnames(
        'cursor-pointer rounded border border-primary p-3 hover:border-hover active:border-accent-primary',
        {
          '!border-accent-primary': selected,
        },
      )}
    >
      <div className="mb-2 flex h-[68px] items-center gap-2 overflow-hidden md:mb-3 md:h-[108px] md:gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center md:size-24">
          <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
        </div>
        <div className="flex grow flex-col justify-center overflow-hidden">
          <h2 className="truncate text-base font-semibold leading-4 text-primary md:mb-1">
            {entity.name}
          </h2>
          <p className="invisible line-clamp-2 size-0 text-ellipsis text-sm text-secondary md:visible md:size-auto">
            {entity.description}
          </p>
        </div>
      </div>

      {/*{!isMobile && (*/}
      {/*  <>*/}
      {/*    <Divider />*/}
      {/*    <CardFooter />*/}
      {/*  </>*/}
      {/*)}*/}
    </div>
  );
};
