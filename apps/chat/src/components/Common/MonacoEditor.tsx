import { Editor, EditorProps } from '@monaco-editor/react';
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { memo, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { TabOption, Tabs } from './Tabs';

import omit from 'lodash-es/omit';

const editorOptions: EditorProps['options'] = {
  minimap: {
    enabled: false,
  },
  padding: {
    top: 12,
    bottom: 12,
  },
  scrollBeyondLastLine: false,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
  },
  automaticLayout: true,
};

interface MonacoFile<T extends string = string> {
  id: T;
  label: string;
  value: string;
  language?: string;
}

interface MonacoEditorProps<T extends string = string> extends EditorProps {
  allowFullScreen?: boolean;
  files?: MonacoFile<T>[];
  onChangeFile?: (fileId: T, newValue: string) => void;
  activeFileId?: T;
  onTabChange?: (fileId: T) => void;
}

export const MonacoEditor = memo(function MonacoEditor(
  props: MonacoEditorProps,
) {
  const { t } = useTranslation(Translation.Common);

  const editorTheme = useAppSelector(UISelectors.selectCodeEditorTheme);

  const [isFullScreen, setIsFullScreen] = useState(false);

  const activeFileId = props.activeFileId ?? props.files?.[0]?.id ?? '';
  const activeFile = useMemo(() => {
    return props.files?.find((f) => f.id === activeFileId);
  }, [props.files, activeFileId]);

  const wrapperStyles = useMemo(
    () =>
      isFullScreen
        ? undefined
        : {
            width: props.width ?? '100%',
            height: props.height ?? '100%',
          },
    [isFullScreen, props.width, props.height],
  );

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  const tabs = useMemo<TabOption[]>(
    () =>
      props.files?.map((f) => ({
        id: f.id,
        label: f.label,
        content: null,
      })) ?? [],
    [props.files],
  );

  const editorProps = useMemo(() => {
    if (!activeFile) return {};

    return {
      value: activeFile.value ?? '',
      language: activeFile.language ?? 'json',
      onChange: (v: string | undefined) => {
        props.onChangeFile?.(activeFileId, v ?? '');
      },
    };
  }, [activeFile, activeFileId, props]);

  return (
    <div
      style={wrapperStyles}
      className={classNames('flex flex-col overflow-hidden', {
        ['!fixed left-0 top-0 z-40 h-[100vh] w-[100vw]']: isFullScreen,
        ['rounded border border-tertiary bg-layer-3']: props.allowFullScreen,
      })}
    >
      {props.allowFullScreen && (
        <div className="flex items-center justify-between  border-tertiary bg-layer-2">
          <div className="flex">
            {props.files && props.files.length > 1 && (
              <Tabs
                tabs={tabs}
                defaultTabId={activeFileId}
                onTabChange={props.onTabChange}
                tabListClassName="flex bg-transparent"
                tabButtonBaseClassName="border-r border-tertiary bg-layer-2 text-sm font-medium focus:outline-none px-4 h-[35px] hover:bg-accent-primary-alpha"
                activeTabButtonClassName="bg-layer-3 text-white"
              />
            )}
          </div>
          <Tooltip tooltip={t(isFullScreen ? 'Minimize' : 'Full screen')}>
            <button
              type="button"
              className="p-2 text-secondary hover:text-accent-primary"
              onClick={(e) => {
                setIsFullScreen(!isFullScreen);
                dispatchMouseLeaveEvent(e);
              }}
            >
              <FullScreenIcon size={18} />
            </button>
          </Tooltip>
        </div>
      )}

      <div
        className={classNames('min-h-0 min-w-0 max-w-full shrink grow', {
          ['p-2']: props.allowFullScreen,
        })}
      >
        <Editor
          {...editorProps}
          options={{ ...editorOptions, ...props.options }}
          theme={editorTheme}
          {...omit(props, ['options', 'width', 'height'])}
          width="100%"
          height="100%"
        />
      </div>
    </div>
  );
});
