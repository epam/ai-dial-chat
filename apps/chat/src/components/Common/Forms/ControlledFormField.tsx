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
  PathValue,
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
  defaultValue?: PathValue<T, K>;
}

export function withController<T extends object>(Component: ComponentType<T>) {
  function ControllerWrapper<F extends FieldValues, K extends Path<F>>({
    control,
    name,
    rules,
    defaultValue = '' as PathValue<F, K>,
    ...props
  }: T & Omit<ControlledFormFieldProps<F, K>, 'children'>) {
    const newRules = useMemo(() => omit(rules ?? {}, 'setValueAs'), [rules]);

    const renderFn = useCallback(
      (cbProps: TRenderFuncProps<F, K>) => {
        const transform = (e: ChangeEvent<HTMLInputElement>) => {
          const { value } = e.target;

          cbProps.field.onChange(rules?.setValueAs?.(value));
        };

        const newField = {
          ...cbProps.field,
          onChange: rules?.setValueAs ? transform : cbProps.field.onChange,
        };

        return <Component {...(props as T)} {...newField} />;
      },
      [props, rules],
    );

    return (
      <Controller
        control={control}
        name={name}
        render={renderFn}
        rules={newRules}
        defaultValue={defaultValue}
      />
    );
  }

  ControllerWrapper.displayName = 'ControllerWrapper';

  return ControllerWrapper;
}
