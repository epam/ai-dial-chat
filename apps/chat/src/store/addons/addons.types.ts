import { ErrorMessage } from '@/src/types/error';
import { AddonsMap, DialAIEntityAddon } from '@/src/types/models';

export interface AddonsState {
  initialized: boolean;
  isLoading: boolean;
  error: ErrorMessage | undefined;
  addons: DialAIEntityAddon[];
  addonsMap: AddonsMap;
  recentAddonsIds: string[];
}
