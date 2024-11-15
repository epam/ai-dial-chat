import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';

export interface ViewProps {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  type: ApplicationType;
  isEdit?: boolean;
  currentReference?: string;
  selectedApplication?: CustomApplicationModel;
}
