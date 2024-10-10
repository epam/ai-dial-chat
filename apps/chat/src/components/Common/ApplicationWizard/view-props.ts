import { CustomApplicationModel } from '@/src/types/applications';

export interface ViewProps {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  isEdit?: boolean;
  currentReference?: string;
  selectedApplication?: CustomApplicationModel;
}
