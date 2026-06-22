import { IconProps } from '@tabler/icons-react';
import { FC, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import classNames from 'classnames';

import { Badge } from '@/src/components/Badge';

interface AuthAccordionProps {
  Icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  title: string;
  isOpen: boolean;
  onClick: () => void;
  children?: ReactNode;

  disabled?: boolean;
  className?: string;
  statusBadge?: {
    label: string;
    type: 'success' | 'error';
  };

  triggerQa?: string;
  titleQa?: string;
  contentQa?: string;
}

export const AuthAccordion: FC<AuthAccordionProps> = ({
  Icon,
  title,
  isOpen,
  onClick,
  children,
  disabled,
  className,
  statusBadge,
  triggerQa,
  titleQa,
  contentQa,
}) => {
  return (
    <div
      className={classNames('overflow-hidden rounded bg-layer-3', className)}
    >
      <button
        onClick={onClick}
        className={classNames(
          'flex w-full gap-3 border-l p-4',
          isOpen ? 'border-accent-primary' : 'border-transparent',
          disabled && 'cursor-not-allowed',
        )}
        disabled={disabled}
        data-qa={triggerQa}
      >
        <Icon
          size={18}
          className={classNames(
            isOpen ? 'text-accent-primary' : 'text-secondary',
          )}
        />

        <span
          className={classNames(
            'text-sm font-semibold',
            isOpen ? 'text-accent-primary' : 'text-primary',
          )}
          data-qa={titleQa}
        >
          {title}
        </span>

        {statusBadge && (
          <Badge
            label={statusBadge.label}
            type={statusBadge.type}
            className="shrink-0"
          />
        )}
      </button>

      {!!(isOpen && children) && (
        <div
          className="flex flex-col gap-4 border-t border-tertiary p-4"
          data-qa={contentQa}
        >
          {children}
        </div>
      )}
    </div>
  );
};
