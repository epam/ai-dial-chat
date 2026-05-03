import { CodeEditorContent } from './CodeEditorContent';
import { CodeEditorPanelHeader } from './CodeEditorPanelHeader';

interface CodeEditorPanelProps {
  isSidebarOpen: boolean;
  isFullScreen: boolean;
  readOnly?: boolean;
  onSidebarToggle: () => void;
  onFullScreenToggle: () => void;
}

export const CodeEditorPanel = ({
  isSidebarOpen,
  isFullScreen,
  readOnly,
  onSidebarToggle,
  onFullScreenToggle,
}: CodeEditorPanelProps) => {
  return (
    <div className="flex max-h-full min-w-0 flex-col divide-y divide-tertiary rounded-r border border-tertiary bg-layer-3">
      <CodeEditorPanelHeader
        isSidebarOpen={isSidebarOpen}
        isFullScreen={isFullScreen}
        onSidebarToggle={onSidebarToggle}
        onFullScreenToggle={onFullScreenToggle}
      />
      <div className="min-h-0 min-w-0 max-w-full shrink grow p-3">
        <CodeEditorContent readOnly={readOnly} />
      </div>
    </div>
  );
};
