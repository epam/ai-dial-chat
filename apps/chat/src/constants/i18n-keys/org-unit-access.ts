/** Why a folder is disabled: the user lacks the org-unit right the action needs, one reason per resource type. */
export enum OrgUnitAccessI18nKeys {
  NoSaveAccessQuickApp = 'orgUnitAccess.noSaveAccessQuickApp',
  NoSaveAccessApplication = 'orgUnitAccess.noSaveAccessApplication',
  NoSaveAccessToolset = 'orgUnitAccess.noSaveAccessToolset',
  NoSaveAccessPrompt = 'orgUnitAccess.noSaveAccessPrompt',
  NoSaveAccessSkill = 'orgUnitAccess.noSaveAccessSkill',
  NoSaveAccessConversation = 'orgUnitAccess.noSaveAccessConversation',
  NoSaveAccessProject = 'orgUnitAccess.noSaveAccessProject',
  NoPublishAccessQuickApp = 'orgUnitAccess.noPublishAccessQuickApp',
  NoPublishAccessApplication = 'orgUnitAccess.noPublishAccessApplication',
  NoPublishAccessToolset = 'orgUnitAccess.noPublishAccessToolset',
  NoPublishAccessPrompt = 'orgUnitAccess.noPublishAccessPrompt',
  NoPublishAccessSkill = 'orgUnitAccess.noPublishAccessSkill',
  NoPublishAccessConversation = 'orgUnitAccess.noPublishAccessConversation',
  NoPublishAccessProject = 'orgUnitAccess.noPublishAccessProject',
  NoWriteAccessDependencies = 'orgUnitAccess.noWriteAccessDependencies',
  /** A selected Organization folder that the org-unit visibility rule hides once the units load. */
  FolderOutsideOrgUnits = 'orgUnitAccess.folderOutsideOrgUnits',
}
