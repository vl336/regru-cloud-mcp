// Smoke test: performs a couple of real read-only calls against the Reg.ru CloudVPS API.
//
// The token is read ONLY from the REGRU_CLOUD_TOKEN environment variable of this
// process (never from argv, never printed). Run it from your own terminal:
//
//   REGRU_CLOUD_TOKEN=<token> npm run smoke        (Linux/macOS/Git Bash)
//   set REGRU_CLOUD_TOKEN=<token> && npm run smoke (Windows CMD)

import { CloudClient } from "../client.js";

async function main(): Promise<void> {
  const token = process.env.REGRU_CLOUD_TOKEN?.trim();
  if (!token) {
    console.error("REGRU_CLOUD_TOKEN не задан. Установите переменную окружения и повторите.");
    process.exit(1);
  }

  const client = new CloudClient(token, process.env.REGRU_CLOUD_API_BASE?.trim() || undefined);

  console.log("== /v1/balance_data ==");
  const balance = (await client.balanceData()) as { balance_data?: unknown };
  console.log(JSON.stringify(balance.balance_data ?? balance, null, 2));

  console.log("== /v1/reglets (первые 2) ==");
  const reglets = (await client.reglets()) as { reglets?: unknown[] };
  const list = Array.isArray(reglets.reglets) ? reglets.reglets.slice(0, 2) : reglets.reglets;
  console.log(JSON.stringify(list, null, 2));

  console.log("OK");
}

main().catch((error: unknown) => {
  console.error("SMOKE FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
