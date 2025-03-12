import { ErrorMessage } from '@/src/types/error';
import { DialAIEntityAddon } from '@/src/types/models';

export interface AddonsState {
  initialized: boolean;
  isLoading: boolean;
  error: ErrorMessage | undefined;
  addons: DialAIEntityAddon[];
  addonsMap: Partial<Record<string, DialAIEntityAddon>>;
  recentAddonsIds: string[];
}
