import { useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { CodeEditorActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { CodeEditorPanel } from './Panel/CodeEditorPanel';
import { CodeEditorSidebar } from './Sidebar/CodeEditorSidebar';

interface CodeEditorProps {
  sourcesFolderId: string | undefined;
  readOnly?: boolean;
  reviewBucket?: string;
}

export const CodeEditor = ({
  sourcesFolderId,
  readOnly,
  reviewBucket,
}: CodeEditorProps) => {
  const dispatch = useAppDispatch();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (sourcesFolderId) {
      dispatch(CodeEditorActions.initCodeEditor({ sourcesFolderId }));
    }
  }, [dispatch, sourcesFolderId]);

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleFullScreenToggle = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <div className="z-40 w-full max-w-full">
      <div
        className={classNames(
          'grid min-h-[400px] w-full max-w-full grid-rows-[100%]',
          isFullScreen ? 'fixed inset-0 z-50' : 'h-[400px]',
          isSidebarOpen ? 'grid-cols-[220px_1fr]' : 'grid-cols-[0px_1fr]',
        )}
      >
        <CodeEditorSidebar
          sourcesFolderId={sourcesFolderId}
          readOnly={readOnly}
          reviewBucket={reviewBucket}
          onToggle={handleSidebarToggle}
        />
        <CodeEditorPanel
          isSidebarOpen={isSidebarOpen}
          isFullScreen={isFullScreen}
          onSidebarToggle={handleSidebarToggle}
          onFullScreenToggle={handleFullScreenToggle}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};
