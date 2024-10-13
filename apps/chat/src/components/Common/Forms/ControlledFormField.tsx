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

interface TRenderFuncProps<T extends FieldValues> {
  field: ControllerRenderProps<T, Path<T>>;
  fieldState: ControllerFieldState;
  formState: UseFormStateReturn<T>;
}

interface ControlledFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  children: (p: TRenderFuncProps<T>) => ReactElement;
  rules?:
    | Omit<
        RegisterOptions<T, Path<T>>,
        'disabled' | 'valueAsNumber' | 'valueAsDate'
      >
    | undefined;
}

export const ControlledFormField = <T extends FieldValues>({
  control,
  name,
  children,
  rules,
}: ControlledFormFieldProps<T>) => {
  const newRules = useMemo(() => omit(rules ?? {}, 'setValueAs'), [rules]);

  const renderFn = useCallback(
    (cbProps: TRenderFuncProps<T>) => {
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
  function ControllerWrapper<F extends FieldValues>({
    control,
    name,
    rules,
    ...props
  }: T & Omit<ControlledFormFieldProps<F>, 'children'>) {
    return (
      <ControlledFormField control={control} name={name} rules={rules}>
        {({ field }) => <Component {...(props as T)} {...field} />}
      </ControlledFormField>
    );
  }

  ControllerWrapper.displayName = 'ControllerWrapper';

  return ControllerWrapper;
}
