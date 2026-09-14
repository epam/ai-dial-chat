/**
 * The two sentinel values of the "Default agent for new chats" preference. Any other stored
 * string is a deployment id — the preference has a three-case grammar and no
 * separate discriminator field.
 *
 * The values are carried over verbatim from chat 1.0's `DEFAULT_AGENT` /
 * `LAST_USED_AGENT` constants, so a value stored by a chat 1.0 deployment stays
 * meaningful here.
 */
export enum DefaultAgentMode {
  DefaultAgent = 'default-agent',
  LastUsedAgent = 'last-used-agent',
}
