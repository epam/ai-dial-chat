import { IconBulb, IconPlus } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { AgentSkillsItem } from './AgentSkillsItem';
import { AgentSkillsModal } from './AgentSkillsModal';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

interface AgentSkillsSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  readonly?: boolean;
  addBtnTooltip?: string;
  tooltip?: string;
}

export const AgentSkillsSelector: React.FC<AgentSkillsSelectorProps> = ({
  value = [],
  onChange,
  readonly,
  addBtnTooltip,
  tooltip,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const quickAppUpdatedPrompt = useAppSelector(
    PromptsSelectors.selectQuickAppUpdatedPrompt,
  );

  useEffect(() => {
    dispatch(PromptsActions.uploadPromptsWithFoldersRecursive());
  }, [dispatch]);

  useEffect(() => {
    if (!quickAppUpdatedPrompt) return;
    const { oldId, newId } = quickAppUpdatedPrompt;
    if (!value.includes(oldId)) return;
    onChange(value.map((id) => (id === oldId ? newId : id)));
  }, [quickAppUpdatedPrompt, onChange, value]);

  const handleRemoveSkill = useCallback(
    (promptId: string) => {
      onChange(value.filter((id) => id !== promptId));
    },
    [onChange, value],
  );

  const handleEditSkill = useCallback(
    (promptId: string) => {
      dispatch(
        PromptsActions.selectPrompt({
          promptId,
          selectInEditMode: true,
          isQuickAppEditPrompt: true,
        }),
      );
    },
    [dispatch],
  );

  const handleOpenModal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

  const handleConfirm = useCallback(
    (ids: string[]) => {
      onChange(ids);
      setIsModalOpen(false);
    },
    [onChange],
  );

  return (
    <div className="relative grow">
      <div className="absolute right-0 top-[-26px]">
        <DialLinkButton
          tooltipProps={{
            tooltip:
              addBtnTooltip ?? tooltip ?? t(MarketplaceI18nKeys.AddAgentSkills),
          }}
          disabled={!!readonly}
          iconBefore={<IconPlus size={18} />}
          label={t(MarketplaceI18nKeys.AddMarketplace)}
          onClick={handleOpenModal}
        />
      </div>

      {!value.length ? (
        <div className="flex flex-col items-center justify-center rounded border border-primary py-4">
          <IconBulb size={60} className="mb-2 text-secondary" stroke={0.5} />
          <span>{t(MarketplaceI18nKeys.NoAgentSkillsAdded)}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-hidden rounded">
          {value.map((promptId) => (
            <AgentSkillsItem
              key={promptId}
              promptId={promptId}
              onDelete={handleRemoveSkill}
              onEdit={handleEditSkill}
              readonly={readonly}
            />
          ))}
        </div>
      )}

      {isModalOpen && !readonly && (
        <AgentSkillsModal
          initialSelectedIds={value}
          onClose={handleCloseModal}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};
