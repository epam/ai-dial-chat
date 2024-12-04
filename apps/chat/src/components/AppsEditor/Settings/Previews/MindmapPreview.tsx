import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  currentProviderId: string;
}

export const MindmapPreview: React.FC<Props> = ({ id, currentProviderId }) => {
  //TO-DO: update url
  const iframeUrl = `http://localhost:3001/chat?authProvider=${currentProviderId}&id=mm-1121-1`;

  return (
    <div className="size-full">
      <IframeRenderer
        iframeUrl={iframeUrl}
        title={id}
        width="100%"
        height="100%"
        targetOrigin={new URL(iframeUrl).origin}
        onMessage={() => null}
        containerClassName="w-full h-full border-none"
      />
    </div>
  );
};
