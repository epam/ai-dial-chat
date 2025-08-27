import {
  ChangeEvent,
  ComponentType,
  ReactElement,
  useCallback,
  useMemo,
} from 'react';
import {
  Control,
  Controller,
  ControllerFieldState,
  ControllerRenderProps,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormStateReturn,
} from 'react-hook-form';

import omit from 'lodash-es/omit';

interface TRenderFuncProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  fieldState: ControllerFieldState;
  formState: UseFormStateReturn<T>;
}

interface ControlledFormFieldProps<T extends FieldValues, K extends Path<T>> {
  control: Control<T>;
  name: K;
  children: (p: TRenderFuncProps<T, K>) => ReactElement;
  rules?: Omit<
    RegisterOptions<T, K>,
    'disabled' | 'valueAsNumber' | 'valueAsDate'
  >;
}

export const ControlledFormField = <T extends FieldValues, K extends Path<T>>({
  control,
  name,
  children,
  rules,
}: ControlledFormFieldProps<T, K>) => {
  const newRules = useMemo(() => omit(rules ?? {}, 'setValueAs'), [rules]);

  const renderFn = useCallback(
    (cbProps: TRenderFuncProps<T, K>) => {
      const transform = (e: ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;

        cbProps.field.onChange(rules?.setValueAs?.(value));
      };

      const newField = {
        ...cbProps.field,
        onChange: rules?.setValueAs ? transform : cbProps.field.onChange,
      };

      return children({ ...cbProps, field: newField });
    },
    [rules, children],
  );

  return (
    <Controller
      control={control}
      name={name}
      render={renderFn}
      rules={newRules}
    />
  );
};

export function withController<T extends object>(Component: ComponentType<T>) {
  function ControllerWrapper<F extends FieldValues, K extends Path<F>>({
    control,
    name,
    rules,
    ...props
  }: T & Omit<ControlledFormFieldProps<F, K>, 'children'>) {
    return (
      <ControlledFormField control={control} name={name} rules={rules}>
        {({ field }) => <Component {...(props as T)} {...field} />}
      </ControlledFormField>
    );
  }

  ControllerWrapper.displayName = 'ControllerWrapper';

  return ControllerWrapper;
}
