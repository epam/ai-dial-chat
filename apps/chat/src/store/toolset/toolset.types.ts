import { ToolsetModel } from '@/src/types/toolsets';

export interface ToolsetState {
  initialized: boolean;
  toolsetsMap: Record<string, ToolsetModel>;
  isLoading: boolean;
}
