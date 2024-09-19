import { createSelector } from '@reduxjs/toolkit';

import { useAppSelector } from '@/src/store/hooks';

type CreateSelectorType = ReturnType<typeof createSelector>;

type ExtractFormattedKey<
  S extends string,
  HasParams extends boolean,
> = HasParams extends true
  ? S extends `select${infer Rest}`
    ? `use${Capitalize<Rest>}`
    : `use${Capitalize<S>}`
  : S extends `select${infer Rest}`
    ? Uncapitalize<Rest>
    : Uncapitalize<S>;

type SelectorsMap = Record<string, CreateSelectorType>;

type State<T> = T extends (...args: infer S) => unknown ? S[0] : never;
type Args<T> = T extends (state: unknown, ...args: infer P) => unknown
  ? P
  : never;

type SelectorFunction<
  T extends (state: State<T> | null, ...args: Args<T>) => unknown,
> =
  Args<T> extends []
    ? ReturnType<T>
    : (state: State<T> | null, ...args: Args<T>) => ReturnType<T>;

// export type HookResult<T extends SelectorsMap> = {
//   [K in keyof T as ExtractFormattedKey<
//       K & string,
//       Args<T[K]> extends [] ? false : true
//   >]: SelectorFunction<T[K]>;
// };

type HookResult<T extends SelectorsMap, F extends (keyof T)[]> = {
  [K in F[number] as ExtractFormattedKey<
    K & string,
    Args<T[K]> extends [] ? false : true
  >]: SelectorFunction<T[K]>;
};

export const createSelectorsHook = <
  T extends SelectorsMap,
  K extends (keyof T)[],
>(
  selectors: T,
) => {
  return (filter?: K) => {
    const filteredSelectors = filterStoreSelectors(selectors, filter);

    type FilteredKeys = keyof typeof filteredSelectors extends K
      ? Required<keyof typeof filteredSelectors>
      : never;

    return Object.entries(filteredSelectors).reduce(
      (acc, [key, selector]) => {
        const hasParams =
          selector.dependencies?.length > 1 &&
          selector.dependencies.at(-1).length > 1;
        const formattedKey: string = hasParams
          ? key.startsWith('select')
            ? `use${key.replace(/^select/, '')}`
            : `use${key.charAt(0).toUpperCase() + key.slice(1)}`
          : key.startsWith('select')
            ? key
                .replace(/^select/, '')
                .replace(/^[A-Z]/, (match) => match.toLowerCase())
            : key;

        if (hasParams) {
          acc[formattedKey as keyof HookResult<T, FilteredKeys>] = ((
            state: State<typeof selector> | null,
            ...args: Args<typeof selector>
          ) =>
            useAppSelector((_state) =>
              selector(state ?? _state, ...args),
            )) as HookResult<T, FilteredKeys>[keyof HookResult<
            T,
            FilteredKeys
          >];
        } else {
          acc[formattedKey as keyof HookResult<T, FilteredKeys>] =
            useAppSelector(selector);
        }

        return acc;
      },
      {} as HookResult<T, FilteredKeys>,
    );
  };
};

const createStoreSelectorsHook = <T extends Record<string, SelectorsMap>>(
  selectors: T,
) => {
  type HookMap = {
    [K in keyof T as `use${Capitalize<string & K>}`]: <
      F extends (keyof T[K])[],
    >(
      filter?: F,
    ) => HookResult<T[K], F>;
  };

  return Object.entries(selectors ?? {}).reduce((acc, [key, selectorObj]) => {
    const hookName =
      `use${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof HookMap;
    acc[hookName] = createSelectorsHook(selectorObj) as HookMap[keyof HookMap];
    return acc;
  }, {} as HookMap);
};

const filterStoreSelectors = <T extends SelectorsMap>(
  selectors: T,
  selectedKeys: (keyof T)[] = Object.keys(selectors) as (keyof T)[],
): Partial<T> => {
  return selectedKeys.reduce((acc: Partial<T>, key) => {
    if (selectors[key]) {
      acc[key] = selectors[key];
    }
    return acc;
  }, {});
};

type FilteredSelectorsType<
  T,
  S extends (keyof T)[] | undefined,
> = S extends undefined
  ? T
  : S extends (keyof T)[]
    ? Pick<T, Extract<S[number], keyof T>>
    : never;

type UseSelectorHooks<S> = {
  [K in keyof S as `use${Capitalize<string & K>}`]: <F extends (keyof S[K])[]>(
    filter?: F,
  ) => HookResult<S[K] & SelectorsMap, F>;
};

export const createUseStoreSelectors = <T extends Record<string, SelectorsMap>>(
  storeSelectors: T,
) => {
  return <S extends (keyof T)[] | undefined = undefined>(
    selectedSelectors?: S,
  ) => {
    const filteredSelectors = filterStoreSelectors(
      storeSelectors,
      selectedSelectors,
    ) as FilteredSelectorsType<T, S>;

    return createStoreSelectorsHook(
      filteredSelectors,
    ) as unknown as UseSelectorHooks<FilteredSelectorsType<T, S>>;
  };
};
