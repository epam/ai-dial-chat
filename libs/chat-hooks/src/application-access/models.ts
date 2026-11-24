import type {
  ApplicationResourceDependencyDto,
  ResourceDependencyAccess,
} from '@epam/ai-dial-chat-api-client';
import type { AccessLevel } from '@epam/ai-dial-chat-shared';
import type { ApplicationAccessContentType } from './types';

/** One configured Access entry: the user's own bucket of one content type with a level. */
export interface ApplicationAccessEntry {
  /** Resource type the entry grants access to; unique among the entries. */
  contentType: ApplicationAccessContentType;
  /** Rights requested on that type. */
  accessLevel: AccessLevel;
}

/** A stored dependency the editor cannot represent; shown read-only and sent back unchanged. */
export interface ApplicationAccessPreservedEntry {
  /** Position of the entry in the stored list. */
  index: number;
  /** Stored `link_id` of the entry. */
  linkId: string;
  /** Stored target URL, byte-exact. */
  url: string;
  /** Stored rights, in stored order. */
  access: ResourceDependencyAccess[];
  /** `Read` or `ReadWrite` when the stored rights, compared as a set, equal Read or Read and Write, whatever kept the entry from being editable; `undefined` for any other set of rights. */
  level?: AccessLevel;
  /** Whether the entry is stored with `required: true`. */
  isRequired: boolean;
}

/** A stored dependency list split into what the editor shows and what it preserves. */
export interface ApplicationAccessPartition {
  /** Editable entries in stored order. */
  entries: ApplicationAccessEntry[];
  /** Entries kept opaque, in stored order. */
  preserved: ApplicationAccessPreservedEntry[];
}

/** Options of {@link useApplicationAccess}. */
export interface UseApplicationAccessOptions {
  /** Dependency list the application is stored with; an empty list when it has none. */
  storedList?: ApplicationResourceDependencyDto[];
  /** Content types the host offers; only these load as editable. Defaults to all seven. */
  contentTypes?: readonly ApplicationAccessContentType[];
}

/** Result of {@link useApplicationAccess}. */
export interface UseApplicationAccessResult {
  /** Configured entries of the draft. */
  entries: ApplicationAccessEntry[];
  /** Read-only entries preserved from the stored list. */
  preserved: ApplicationAccessPreservedEntry[];
  /** Replaces the configured entries of the draft. */
  setEntries: (entries: ApplicationAccessEntry[]) => void;
  /** Whether the draft, merged with the preserved entries, differs from the baseline. */
  isDirty: boolean;
  /**
   * Discards the draft. With a list, that list becomes the new baseline,
   * for example the one just saved.
   */
  reset: (nextBaseline?: ApplicationResourceDependencyDto[]) => void;
  /** The full list to send: `undefined` while untouched, `[]` for an explicit clear. */
  toRequestValue: () => ApplicationResourceDependencyDto[] | undefined;
}
