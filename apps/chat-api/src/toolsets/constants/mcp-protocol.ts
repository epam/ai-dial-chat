/*
 * Wire-protocol settings for the BFF's MCP Streamable HTTP handshake.
 * The proxy owns protocol negotiation and the client identity it advertises.
 */

/** MCP protocol version advertised in the `initialize` handshake. */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/** Header the MCP Streamable HTTP transport uses to carry the session id. */
export const MCP_SESSION_ID_HEADER = 'mcp-session-id';

/**
 * Header carrying the protocol version the server negotiated in its
 * `initialize` result. The MCP lifecycle requires it on every request that
 * follows a completed handshake, so a server that supports several versions
 * keeps answering in the one it agreed on.
 */
export const MCP_PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

/** Client identity advertised in the `initialize` handshake. */
export const MCP_CLIENT_INFO = { name: 'ai-dial-chat', version: '1.0.0' };
