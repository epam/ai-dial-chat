import {
  IconAlertSmall,
  IconCheck,
  IconPointFilled,
  IconProps,
} from '@tabler/icons-react';
import {
  ForwardRefExoticComponent,
  Fragment,
  RefAttributes,
  useMemo,
} from 'react';

import classNames from 'classnames';

const getIcon = (
  active: boolean,
  Icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>,
  iconStyles: string,
  wrapperStyles: string,
  size?: number,
) => (
  <div
    className={classNames(
      'flex size-[24px] items-center justify-center rounded-full',
      wrapperStyles,
    )}
  >
    <Icon
      className={iconStyles}
      data-qa={active ? 'selected-step-icon' : 'not-selected-step-icon'}
      width={size ?? 24}
      height={size ?? 24}
    />
  </div>
);

interface StepProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  error?: boolean;
  completed?: boolean;
}

const Step = ({
  label,
  onClick,
  active,
  disabled,
  error,
  completed,
}: StepProps) => {
  const Icon = useMemo(() => {
    if (error)
      return getIcon(
        !!active,
        IconAlertSmall,
        'text-error',
        classNames('bg-error', active && 'border border-error'),
      );
    if (active)
      return getIcon(
        true,
        IconPointFilled,
        'text-accent-primary',
        'bg-accent-primary-alpha border border-accent-primary',
        22,
      );
    if (completed)
      return getIcon(
        false,
        IconCheck,
        'text-accent-primary',
        'bg-accent-primary-alpha',
        18,
      );
    return getIcon(false, IconPointFilled, 'text-secondary', 'bg-layer-4', 22);
  }, [active, completed, error]);

  return (
    <div
      className={classNames(
        'group flex shrink items-center gap-2 border-b px-2 py-3',
        !disabled && !active ? 'cursor-pointer' : 'cursor-default',
        {
          'border-error': active && error,
          'border-accent-primary': active,
          'border-transparent': !active,
        },
      )}
      data-qa="single-step-link"
      onClick={onClick}
    >
      {Icon}

      <span
        className={classNames('grow truncate', {
          'text-secondary': disabled,
          'group-hover:text-error': error && !active,
          'group-hover:text-accent-primary': completed && !active,
        })}
        data-qa="single-step-title"
      >
        {label}
      </span>
    </div>
  );
};

interface StepType<T extends string> {
  label: string;
  key: T;
  disabled: boolean;
  error?: boolean;
  completed?: boolean;
}

interface StepperProps<T extends string> {
  steps: StepType<T>[];
  active: T;
  onChange: (step: StepType<T>) => void;
  className?: string;
}

export const Stepper = <T extends string>({
  steps,
  active,
  onChange,
  className,
}: StepperProps<T>) => {
  return (
    <div
      data-qa="steps-container"
      className={classNames('flex items-center', className)}
    >
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          <Step
            label={step.label}
            disabled={step.disabled}
            error={step.error}
            completed={step.completed}
            active={step.key === active}
            onClick={() => onChange(step)}
          />
          {index < steps.length - 1 && (
            <div
              className="mx-2 h-0.5 w-5"
              style={{ backgroundColor: 'var(--text-secondary)' }}
            ></div>
          )}
        </Fragment>
      ))}
    </div>
  );
};
