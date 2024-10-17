import { IconHelp } from '@tabler/icons-react';
import { ComponentType, FC, forwardRef } from 'react';

import { DefaultTFuncReturn } from 'i18next';

import Tooltip from '@/src/components/Common/Tooltip';

import omit from 'lodash-es/omit';

interface LabelProps {
  children?: string | DefaultTFuncReturn;
  htmlFor?: string;
  mandatory?: boolean;
  info?: string | DefaultTFuncReturn;
}

export const Label: FC<LabelProps> = ({
  children,
  htmlFor,
  mandatory,
  info,
}) => (
  <label
    className="mb-1 flex items-center gap-1 text-xs text-secondary"
    htmlFor={htmlFor}
  >
    {children}
    {mandatory && <span className="ml-1 inline text-accent-primary">*</span>}
    {info && (
      <Tooltip
        tooltip={info}
        triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
        contentClassName="max-w-[220px]"
        placement="top-end"
      >
        <IconHelp size={18} />
      </Tooltip>
    )}
  </label>
);

interface WithLabelProps {
  id?: string;
  label?: LabelProps['children'];
  mandatory?: boolean;
  info?: LabelProps['info'];
}

export function withLabel<T extends object, R>(
  Component: ComponentType<T>,
  excludeLabel?: boolean,
) {
  const LabelWrapper = forwardRef<R, WithLabelProps & T>(
    ({ info, mandatory, ...props }, ref) => (
      <div className="flex flex-col">
        <Label htmlFor={props?.id} mandatory={mandatory} info={info}>
          {props.label}
        </Label>

        <Component
          {...(omit(props, excludeLabel ? ['label'] : []) as T)}
          ref={ref}
        />
      </div>
    ),
  );

  LabelWrapper.displayName = 'LabelWrapper';

  return LabelWrapper;
}
