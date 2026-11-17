import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input, RadioGroup } from '@epam/ai-dial-ui-kit';
import { FC, useId } from 'react';
import type {
  SaveToFolderPanelColors,
  SaveToFolderVersionProps,
} from '../../models/save-to-folder-panel';
import { SaveVersionMode } from '../../types/save-to-folder';
import styles from './SaveToFolderPanel.module.scss';

/** Props of the version section of the save-to-folder panel. */
interface SaveToFolderVersionSectionProps {
  /** Version choice state and callbacks. */
  version: SaveToFolderVersionProps;
  /** Heading of the section. */
  heading: string;
  /** Label of the keep-version option; `{version}` is replaced. */
  keepVersionLabel: string;
  /** Label of the new-version option. */
  saveAsNewVersionLabel: string;
  /** Label of the new version input. */
  newVersionLabel: string;
  /** Placeholder of the new version input. */
  newVersionPlaceholder: string;
  /** Whether every control is disabled. */
  isSubmitting: boolean;
  /** Typography class of the heading. */
  headingClassName: string;
  /** Color overrides of the panel body. */
  colors?: SaveToFolderPanelColors;
}

/** Version choice of the save-to-folder panel: keep the current version or save a new one. */
export const SaveToFolderVersionSection: FC<
  SaveToFolderVersionSectionProps
> = ({
  version,
  heading,
  keepVersionLabel,
  saveAsNewVersionLabel,
  newVersionLabel,
  newVersionPlaceholder,
  isSubmitting,
  headingClassName,
  colors,
}) => {
  const newVersionInputId = useId();
  const cssVars = buildCssVars({ '--stf-heading-text': colors?.headingText });

  const items = [
    {
      value: SaveVersionMode.Keep,
      label: keepVersionLabel.replace('{version}', version.currentVersion),
    },
    {
      value: SaveVersionMode.New,
      label: saveAsNewVersionLabel,
      content: (
        <Input
          id={newVersionInputId}
          value={version.newVersion}
          onChange={(value) => version.onNewVersionChange(value ?? '')}
          onBlur={version.onNewVersionBlur}
          labelProps={{ label: newVersionLabel, required: true }}
          placeholder={newVersionPlaceholder}
          error={version.newVersionError}
          invalid={Boolean(version.newVersionError)}
          disabled={isSubmitting}
        />
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-2" style={cssVars}>
      <h2 className={mergeClasses(headingClassName, styles.heading)}>
        {heading}
      </h2>
      <RadioGroup
        ariaLabel={heading}
        value={version.versionMode}
        onChange={(value) =>
          version.onVersionModeChange(value as SaveVersionMode)
        }
        items={items}
        disabled={isSubmitting}
      />
    </section>
  );
};
