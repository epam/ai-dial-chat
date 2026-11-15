import { useEffect, useState } from 'react';
import { PublishPanelView } from '../types/publish-panel';

/** Options for {@link usePublishFolderView}. */
export interface UsePublishFolderViewOptions {
  /** Whether the publish flow is shown; every opening starts on the main view. */
  isOpen: boolean;
  /** Committed destination folder path; `[]` is the bucket root. */
  selectedFolderPath?: string[];
  /** Called with the pending path when the user confirms it with Select. */
  onSelectedFolderPathChange: (path: string[] | undefined) => void;
}

/** View state returned by {@link usePublishFolderView}. */
export interface UsePublishFolderViewResult {
  /** The view the panel shows. */
  view: PublishPanelView;
  /** Folder picked in the folder view but not yet confirmed. */
  pendingFolderPath?: string[];
  /** Updates the pending folder. */
  setPendingFolderPath: (path: string[] | undefined) => void;
  /** Opens the folder view, starting from the committed folder. */
  openFolderView: () => void;
  /** Returns to the main view and discards the pending folder. */
  backToMain: () => void;
  /** Commits the pending folder and returns to the main view. */
  selectFolder: () => void;
}

/** Holds the main/folder view switch of the publish panel and the folder picked before Select commits it. */
export const usePublishFolderView = ({
  isOpen,
  selectedFolderPath,
  onSelectedFolderPathChange,
}: UsePublishFolderViewOptions): UsePublishFolderViewResult => {
  const [view, setView] = useState(PublishPanelView.Main);
  const [pendingFolderPath, setPendingFolderPath] = useState<string[]>();

  useEffect(() => {
    if (isOpen) setView(PublishPanelView.Main);
  }, [isOpen]);

  const openFolderView = () => {
    setPendingFolderPath(selectedFolderPath);
    setView(PublishPanelView.ChangeFolder);
  };

  const backToMain = () => setView(PublishPanelView.Main);

  const selectFolder = () => {
    if (pendingFolderPath != null)
      onSelectedFolderPathChange(pendingFolderPath);
    setView(PublishPanelView.Main);
  };

  return {
    view,
    pendingFolderPath,
    setPendingFolderPath,
    openFolderView,
    backToMain,
    selectFolder,
  };
};
