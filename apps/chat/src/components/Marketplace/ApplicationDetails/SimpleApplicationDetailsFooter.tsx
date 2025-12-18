import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';

import { ApplicationDetailsFooterProps } from './ApplicationDetails';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

export const SimpleApplicationDetailsFooter = ({
  entity,
  onChangeVersion,
  onRemove,
}: ApplicationDetailsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const handleRemove = () => {
    onRemove?.(entity);
  };

  return (
    <div className="flex items-center justify-end gap-4 p-4">
      <ModelVersionSelect
        className="h-max"
        entities={[entity]}
        showVersionPrefix
        onSelect={onChangeVersion}
        currentEntity={entity}
      />
      <DialButton
        onClick={handleRemove}
        data-qa="remove"
        label={t('Remove')}
        variant={ButtonVariant.Secondary}
      />
    </div>
  );
};
