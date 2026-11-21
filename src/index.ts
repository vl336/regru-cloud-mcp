#!/usr/bin/env node
// Read-only MCP server for Reg.ru Cloud (CloudVPS API), stdio transport.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloudClient } from "./client.js";
import { buildTools } from "./tools.js";

const SERVER_NAME = "regru-cloud-mcp";
const SERVER_VERSION = "0.1.0";

function fail(message: string): never {
  // stderr only: stdout is the MCP protocol channel
  console.error(`${SERVER_NAME}: ${message}`);
  process.exit(1);
}

const token = process.env.REGRU_CLOUD_TOKEN?.trim();
if (!token) {
  fail(
    "переменная окружения REGRU_CLOUD_TOKEN не задана. " +
      "Укажите её в env-блоке настройки MCP-сервера вашего клиента " +
      "(токен берётся в панели Рег.облака: Настройки → API-токен)."
  );
}

const client = new CloudClient(token, process.env.REGRU_CLOUD_API_BASE?.trim() || undefined);
const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

for (const tool of buildTools(client)) {
  server.tool(tool.name, tool.description, tool.paramsSchema, async (args) => {
    try {
      const text = await tool.handler(args as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : `Неизвестная ошибка: ${String(cause)}`;
      return {
        content: [{ type: "text", text: `Ошибка: ${message}` }],
        isError: true,
      };
    }
  });
}

await server.connect(new StdioServerTransport());
// No token or request details are ever logged.
console.error(`${SERVER_NAME}: готов (read-only, base=${process.env.REGRU_CLOUD_API_BASE?.trim() || "https://api.cloudvps.reg.ru"})`);
