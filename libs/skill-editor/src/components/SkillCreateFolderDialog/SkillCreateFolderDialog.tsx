import { Input } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { useEffect, useId, useState } from 'react';
import type { SkillCreateFolderDialogProps } from '../../models/skill-create-folder-dialog-props';
import { SkillEditorDialog } from '../SkillEditorDialog/SkillEditorDialog';

/** Dialog that names a new folder, used below the `desktop` breakpoint in place of the inline tree draft. */
export const SkillCreateFolderDialog: FC<SkillCreateFolderDialogProps> = ({
  isOpen,
  onClose,
  validateName,
  onCreate,
  title,
  nameLabel,
  namePlaceholder,
  createLabel,
  cancelLabel,
  closeAriaLabel,
  dialogColors,
}) => {
  const inputId = useId();
  const [name, setName] = useState('');
  /* The field stays quiet until the first Create, then re-checks as the user edits. */
  const [hasAttemptedCreate, setHasAttemptedCreate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setHasAttemptedCreate(false);
  }, [isOpen]);

  const error = hasAttemptedCreate ? validateName(name) : undefined;

  const handleCreate = () => {
    setHasAttemptedCreate(true);
    if (validateName(name) != null) return;
    onCreate(name);
    onClose();
  };

  return (
    <SkillEditorDialog
      isOpen={isOpen}
      title={title}
      closeAriaLabel={closeAriaLabel}
      onClose={onClose}
      confirmLabel={createLabel}
      onConfirm={handleCreate}
      cancelLabel={cancelLabel}
      onCancel={onClose}
      colors={dialogColors}
    >
      <form
        className="px-4 py-4 desktop:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleCreate();
        }}
      >
        <Input
          id={inputId}
          labelProps={{ label: nameLabel, htmlFor: inputId, required: true }}
          value={name}
          placeholder={namePlaceholder}
          error={error}
          invalid={error != null}
          onChange={(value) => setName(value ?? '')}
        />
      </form>
    </SkillEditorDialog>
  );
};
