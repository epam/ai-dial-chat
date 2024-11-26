import { FormData } from './form';

interface GeneralInfoPreviewProps {
  data: FormData;
}

export const GeneralInfoPreview = (_props: GeneralInfoPreviewProps) => {
  return (
    <div className="flex size-full max-w-[1000px] flex-col overflow-hidden p-6">
      <h2>Preview</h2>
    </div>
  );
};
