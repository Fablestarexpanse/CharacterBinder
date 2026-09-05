#!/usr/bin/env node
/**
 * CharacterBinder MCP server — the stdio entry point.
 *
 * The tools themselves are in server.ts; this file is only the two side effects
 * that make them reachable: the bridge the app dials in on, and the transport
 * the agent speaks over.
 *
 * stdout is the MCP transport. Never write to it — logs go to stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { startBridge } from "./bridge.js";

startBridge();
await server.connect(new StdioServerTransport());
console.error("[characterbinder-mcp] ready on stdio");
