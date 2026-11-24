import { useRef } from 'react';
import { CreatedResourceMemory } from '../created-resource-memory';

/** Returns a {@link CreatedResourceMemory} that lives as long as the component. */
export const useCreatedResourceMemory = (): CreatedResourceMemory => {
  const ref = useRef<CreatedResourceMemory>(null);
  ref.current ??= new CreatedResourceMemory();
  return ref.current;
};
