/*
 * Shared MCP wire-protocol constants used by every surface that talks to an
 * MCP server over the Streamable HTTP transport. `apps/chat-api`'s MCP proxy
 * (the `initialize` handshake fallback) imports them through this package's
 * `./constants` entry point so it never pulls the React-peered barrel.
 */

/** MCP protocol version advertised in the `initialize` handshake. */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/** Header the MCP Streamable HTTP transport uses to carry the session id. */
export const MCP_SESSION_ID_HEADER = 'mcp-session-id';

/** Client identity advertised in the `initialize` handshake. */
export const MCP_CLIENT_INFO = { name: 'ai-dial-chat', version: '1.0.0' };
