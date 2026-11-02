import { useCallback, useState } from 'react';

/** Host storage operations; a nullish read means no stored value. */
export interface PersistedStateStorage<TStored> {
  /** Reads a host-owned key. */
  read: (key: string) => TStored | null | undefined;
  /** Writes a host-owned key. */
  write: (key: string, value: TStored) => void;
}
/** Host serialization policy. */
export interface PersistedStateCodec<T, TStored> {
  /** Converts storage data into state. */
  decode: (value: TStored) => T;
  /** Converts state into storage data. */
  encode: (value: T) => TStored;
}
/** Inputs for mount-initialized persisted state. */
export interface UsePersistedStateOptions<T, TStored> {
  /** Host-owned storage key. */
  key: string;
  /** Fallback when reading or decoding fails. */
  initialValue: T;
  /** Host storage implementation. */
  storage: PersistedStateStorage<TStored>;
  /** Host serialization implementation. */
  codec: PersistedStateCodec<T, TStored>;
}
/** Initializes once from storage and preserves in-memory updates when persistence fails. */
export const usePersistedState = <T, TStored>({
  key,
  initialValue,
  storage,
  codec,
}: UsePersistedStateOptions<T, TStored>): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = storage.read(key);
      return stored == null ? initialValue : codec.decode(stored);
    } catch {
      return initialValue;
    }
  });
  const write = storage.write;
  const encode = codec.encode;
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        write(key, encode(next));
      } catch {
        /* Persistence failure leaves the in-memory update intact. */
      }
    },
    [key, write, encode],
  );
  return [value, update];
};
