import { IconHelp } from '@tabler/icons-react';
import { ComponentType, FC, forwardRef } from 'react';

import { DefaultTFuncReturn } from 'i18next';

import classNames from 'classnames';

import { Tooltip } from '@/src/components/Common/Tooltip';

import omit from 'lodash-es/omit';

interface LabelProps {
  children?: string | DefaultTFuncReturn;
  htmlFor?: string;
  mandatory?: boolean;
  isSubgroup?: boolean;
  info?: string | DefaultTFuncReturn;
}

export const Label: FC<LabelProps> = ({
  children,
  htmlFor,
  mandatory,
  isSubgroup = false,
  info,
}) => (
  <label
    className={classNames(
      'flex items-center gap-1 text-xs text-secondary',
      isSubgroup ? 'mb-1' : 'mb-2',
    )}
    data-qa={htmlFor?.concat('-label')}
    htmlFor={htmlFor}
  >
    {children}
    {mandatory && <span className="ml-1 inline text-accent-primary">*</span>}
    {info && (
      <Tooltip
        tooltip={info}
        triggerClassName="flex shrink-0 p-1 text-secondary hover:text-accent-primary"
        contentClassName="z-[2000]"
        dataQa={htmlFor ? `${htmlFor}-info` : undefined}
      >
        <IconHelp size={16} />
      </Tooltip>
    )}
  </label>
);

interface WithLabelProps {
  id?: string;
  label?: LabelProps['children'];
  mandatory?: boolean;
  isSubgroup?: boolean;
  info?: LabelProps['info'];
}

export function withLabel<T extends object, R>(
  Component: ComponentType<T>,
  excludeLabel?: boolean,
) {
  const LabelWrapper = forwardRef<R, WithLabelProps & T>(
    ({ info, mandatory, isSubgroup, ...props }, ref) => (
      <div className="flex flex-col" data-qa={props.id}>
        <Label
          htmlFor={props?.id}
          mandatory={mandatory}
          info={info}
          isSubgroup={isSubgroup}
        >
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
