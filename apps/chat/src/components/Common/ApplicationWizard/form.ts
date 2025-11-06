import { DynamicField } from '@/src/components/Common/Forms/DynamicFormFields';

export interface CodeData {
  // DEPLOYABLE APP
  sources: string;
  sourceFiles?: string[];
  runtime: string;
  endpoints: DynamicField[];
  env: DynamicField[];
}
