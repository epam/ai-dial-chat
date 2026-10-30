import type { ConversationStartKind } from '../types/conversation-start-kind';

/** Calendar-day classification of a conversation start plus its localized time or date text. */
export interface ConversationStartParts {
  /** Which label form applies. */
  kind: ConversationStartKind;
  /** Localized time for `Today`/`Yesterday`; full localized date and time for `Absolute`. */
  text: string;
}

/** Localised templates for `ConversationStartTimestamp`. */
export interface ConversationStartTimestampLabels {
  /** Builds the label for a start earlier today from the localized time. Defaults to `` (time) => `Today ${time}` ``. */
  today?: (time: string) => string;
  /** Builds the label for a start on the previous day from the localized time. Defaults to `` (time) => `Yesterday ${time}` ``. */
  yesterday?: (time: string) => string;
}

/** CSS custom property overrides for `ConversationStartTimestamp`. */
export interface ConversationStartTimestampColors {
  /** Text color of the label. Defaults to `--text-secondary`. */
  text?: string;
}

/** Props for `ConversationStartTimestamp`. */
export interface ConversationStartTimestampProps {
  /** ISO-8601 start time, usually the first message's `timestamp`. Nothing renders when it is missing or unparsable. */
  timestamp: string;
  /** BCP 47 locale for the time and date. Defaults to the runtime's default locale. */
  locale?: string;
  /** Localised "Today"/"Yesterday" templates. */
  labels?: ConversationStartTimestampLabels;
  /** Typography class on the label. Defaults to `'dial-small-text'`. */
  className?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: ConversationStartTimestampColors;
}

/** Props for the relative send time rendered in a message's action row. */
export interface MessageTimestampProps {
  /** ISO-8601 send time of the message. Nothing renders when it is missing or unparsable. */
  timestamp: string;
  /** BCP 47 locale for the relative text and the absolute tooltip. Defaults to the runtime's default locale. */
  locale?: string;
  /** Typography class on the time. Defaults to `'dial-small-text'`. */
  className?: string;
}
