import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import { NeutralButton } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialNotification,
  DialSkeleton,
  ElementSize,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconChevronDown, IconUsers } from '@tabler/icons-react';
import { FC, KeyboardEvent, useState } from 'react';
import {
  AccessRole,
  FolderAccessGroup,
  FolderAccessMember,
} from '../../models/folder-access';
import styles from './FolderAccess.module.scss';

/** Text overrides for all user-visible strings in {@link FolderAccess}. */
export interface FolderAccessTexts {
  /** Display label for each {@link AccessRole}. */
  roleLabels?: Record<AccessRole, string>;
  /** Suffix appended to the current user's own name. Default: `' (you)'`. */
  youSuffix?: string;
  /** Builds each group row's accessible label; `{name}`/`{role}`/`{count}` are replaced. */
  groupRowAriaLabel?: (group: FolderAccessGroup, roleLabel: string) => string;
  /** Builds each person row's accessible label; `{name}`/`{role}` are replaced. */
  memberRowAriaLabel?: (
    member: FolderAccessMember,
    roleLabel: string,
  ) => string;
  /** Label for the retry button shown alongside the error message. */
  retryLabel?: string;
  /** Message shown when neither `people` nor `groups` has any entries. */
  emptyStateText?: string;
  /** Placeholder for the inline add-member name input. Default: `'Add member by name or email'`. */
  newMemberNamePlaceholder?: string;
  /** Accessible label for the inline add-member name input. Default: `'New member name'`. */
  newMemberNameAriaLabel?: string;
  /** Accessible label for the add-member role dropdown. Default: `'New member role'`. */
  newMemberRoleAriaLabel?: string;
  /** Label for the confirm button in the inline add-member row. Default: `'Add'`. */
  confirmAddMemberLabel?: string;
}

/** Props for {@link FolderAccess}. */
export interface FolderAccessProps {
  /** Individual people with access to the folder. */
  people: FolderAccessMember[];
  /** Groups with access to the folder. */
  groups: FolderAccessGroup[];
  /** The viewer's own id; the matching person in `people` is labelled "(you)". */
  currentUserId: string;
  /** Whether access data is still loading; renders a skeleton in place of the content. */
  isLoading?: boolean;
  /** Error message if access data failed to load; renders in place of the content. */
  error?: string | null;
  /** Called when the user retries after `error`. */
  onRetry?: () => void;
  /**
   * Called with the new member's name and selected role when the user
   * confirms the inline add-member row. The caller owns adding the new
   * member into `people`; this component only reports intent. The row is
   * hidden when omitted.
   */
  onAddMember?: (name: string, role: AccessRole) => void;
  /** Text overrides for all user-visible strings. */
  texts?: FolderAccessTexts;
}

const DEFAULT_ROLE_LABELS: Record<AccessRole, string> = {
  [AccessRole.Owner]: 'Owner',
  [AccessRole.Editor]: 'Editor',
  [AccessRole.Viewer]: 'Viewer',
};

// Caps the list at ~5 visible rows before it scrolls, per row height at the
// current padding (py-2.5 content + gap).
const LIST_MAX_HEIGHT_PX = 240;

/**
 * Read-only summary of who has access to the currently selected publish
 * destination folder: a compact, scrollable list of groups and people with
 * their access role, plus an always-visible inline row for adding a new
 * member by name and role. Purely presentational — `people`/`groups`/
 * `isLoading`/`error` are supplied by the host, which owns fetching the
 * real data and persisting members added via `onAddMember`.
 */
export const FolderAccess: FC<FolderAccessProps> = ({
  people,
  groups,
  currentUserId,
  isLoading = false,
  error = null,
  onRetry,
  onAddMember,
  texts = {},
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AccessRole>(
    AccessRole.Viewer,
  );
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const { youSuffix = ' (you)' } = texts;

  const withYouSuffix = (member: FolderAccessMember): string =>
    member.id === currentUserId ? `${member.name}${youSuffix}` : member.name;

  const {
    roleLabels = DEFAULT_ROLE_LABELS,
    groupRowAriaLabel = (group: FolderAccessGroup, roleLabel: string) =>
      `${group.name}, ${roleLabel}, ${group.memberCount} members`,
    memberRowAriaLabel = (member: FolderAccessMember, roleLabel: string) =>
      `${withYouSuffix(member)}, ${roleLabel}`,
    retryLabel = 'Retry',
    emptyStateText = 'No access information for this folder yet.',
    newMemberNamePlaceholder = 'Add member by name or email',
    newMemberNameAriaLabel = 'New member name',
    newMemberRoleAriaLabel = 'New member role',
    confirmAddMemberLabel = 'Add',
  } = texts;

  const confirmAddingMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      return;
    }
    onAddMember?.(trimmed, newMemberRole);
    setNewMemberName('');
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <DialSkeleton showTitle={{ width: '80%' }} paragraph={false} />
        <DialSkeleton showTitle={{ width: '65%' }} paragraph={false} />
        <DialSkeleton showTitle={{ width: '70%' }} paragraph={false} />
      </div>
    );
  }

  if (error) {
    return (
      <DialNotification
        variant={NotificationVariant.Error}
        message={
          <span className="flex items-center gap-3">
            {error}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="dial-tiny-semi-text shrink-0 text-accent-primary"
              >
                {retryLabel}
              </button>
            )}
          </span>
        }
      />
    );
  }

  const hasEntries = people.length > 0 || groups.length > 0;

  const renderRole = (role: AccessRole) => (
    <span
      aria-hidden
      className="dial-small-text shrink-0 whitespace-nowrap text-secondary"
    >
      {roleLabels[role]}
    </span>
  );

  return (
    <div>
      {hasEntries ? (
        <ul
          className="overflow-y-auto"
          style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
        >
          {groups.map((group) => (
            <li
              key={group.id}
              aria-label={groupRowAriaLabel(group, roleLabels[group.role])}
              className="flex items-center gap-2 py-2.5"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-primary-alpha text-accent-primary"
                aria-hidden
              >
                <IconUsers size={DIAL_ICON_SIZE.SM} />
              </span>
              <span
                className="dial-small-semi-text min-w-0 flex-1 truncate text-primary"
                aria-hidden
              >
                {group.name}
              </span>
              {renderRole(group.role)}
            </li>
          ))}
          {people.map((member) => (
            <li
              key={member.id}
              aria-label={memberRowAriaLabel(member, roleLabels[member.role])}
              className="flex items-center gap-2 py-2.5"
            >
              <span aria-hidden>
                <DeploymentIcon
                  size={24}
                  initialsName={member.name}
                  badgeClassName="!rounded-full"
                />
              </span>
              <span
                className="dial-small-text min-w-0 flex-1 truncate text-primary"
                aria-hidden
              >
                {withYouSuffix(member)}
              </span>
              {renderRole(member.role)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dial-small-text text-secondary">{emptyStateText}</p>
      )}

      {onAddMember && (
        <div
          className={mergeClasses(
            'flex items-center gap-2 pt-2.5',
            hasEntries && 'border-t border-tertiary',
          )}
        >
          <div
            className={mergeClasses(
              'flex min-h-9 min-w-0 flex-1 items-center rounded-lg px-3',
              styles.inputRow,
            )}
          >
            <input
              type="text"
              aria-label={newMemberNameAriaLabel}
              placeholder={newMemberNamePlaceholder}
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  confirmAddingMember();
                }
              }}
              className="dial-small-text min-w-0 flex-1 border-0 bg-transparent p-0 text-primary outline-none"
            />
          </div>
          <DialDropdown
            matchReferenceWidth={false}
            placement="bottom-end"
            open={isRoleDropdownOpen}
            onOpenChange={setIsRoleDropdownOpen}
            listClassName={mergeClasses('!p-1', styles.dropdownOverlay)}
            items={Object.values(AccessRole).map((role) => ({
              key: role,
              label: (
                <span className="dial-small-text flex w-full items-center justify-between gap-2 font-normal">
                  {roleLabels[role]}
                  {role === newMemberRole && (
                    <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                  )}
                </span>
              ),
              className: styles.dropdownRow,
              onClick: () => setNewMemberRole(role),
            }))}
          >
            {/* The trigger's accessible name comes from its own visible
                label text (the current role), so no extra aria-label
                wrapper is needed here (unlike DialSelect's popup trigger). */}
            <button
              type="button"
              aria-label={newMemberRoleAriaLabel}
              aria-haspopup="listbox"
              aria-expanded={isRoleDropdownOpen}
              className={mergeClasses(
                'dial-small-text flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-primary',
                styles.dropdownTrigger,
                isRoleDropdownOpen && styles.dropdownTriggerOpen,
              )}
            >
              {roleLabels[newMemberRole]}
              <IconChevronDown
                size={DIAL_ICON_SIZE.SM}
                className={mergeClasses(
                  'shrink-0 text-tertiary transition-transform duration-150',
                  isRoleDropdownOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          </DialDropdown>
          <NeutralButton
            label={confirmAddMemberLabel}
            size={ElementSize.Small}
            onClick={confirmAddingMember}
            className="!h-9 min-w-20 shrink-0"
          />
        </div>
      )}
    </div>
  );
};
