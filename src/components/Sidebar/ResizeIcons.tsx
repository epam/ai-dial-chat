import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface ResizeIconProps {
  className: string;
}

export const LeftSideResizeIcon = ({ className }: ResizeIconProps) => {
  return (
    <div className={className} data-qa="left-rezise-icon">
      <IconChevronLeft className="-ml-6 h-full" />
    </div>
  );
};

export const RightSideResizeIcon = ({ className }: ResizeIconProps) => {
  return (
    <div className={className} data-qa="right-rezise-icon">
      <IconChevronRight className="h-full" />
    </div>
  );
};
