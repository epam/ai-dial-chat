import { Card, CatalogEntityType } from '@epam/ai-dial-catalog';
import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolsetEditorI18nKeys } from '../../constants/translation-keys';
import type { ToolsetFormData } from '../../types/toolsets';

interface Props {
  form: ToolsetFormData;
}

const ToolsetPreview: FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  const previewItem = useMemo<CatalogItem>(
    () => ({
      id: 'preview',
      type: CatalogEntityType.Toolset,
      name: form.name,
      version: form.version,
      lastUsed: '',
      description: form.description,
      folder: [],
      topics: form.topics,
      iconUrl: form.iconUrl.trim() || undefined,
    }),
    [form.name, form.version, form.description, form.topics, form.iconUrl],
  );

  return (
    <div className="flex w-1/2 flex-col bg-layer-1 p-4">
      <p className="dial-small-text text-secondary">
        {t(ToolsetEditorI18nKeys.PreviewTitle)}
      </p>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-[280px]">
          <Card item={previewItem} />
        </div>
      </div>
    </div>
  );
};

export default memo(ToolsetPreview);
