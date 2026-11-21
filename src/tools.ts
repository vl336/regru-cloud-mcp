import { z } from "zod";
import type { CloudClient } from "./client.js";

export interface ToolDef {
  name: string;
  description: string;
  paramsSchema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

function toJson(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

/** Все инструменты — только чтение (GET-эндпоинты CloudVPS API). */
export function buildTools(client: CloudClient): ToolDef[] {
  return [
    {
      name: "cloud_balance",
      description:
        "Баланс Рег.облака (Reg.ru Cloud): остаток денег и бонусов, hourly_cost/monthly_cost — сколько списывают все ресурсы за час и за месяц, days_left/hours_left — на сколько хватит средств, и detalization — детализация: какой ресурс сколько потребляет (серверы, бэкапы, IP и т.д.).",
      paramsSchema: {},
      handler: async () => {
        const data = (await client.balanceData()) as { balance_data?: unknown };
        return toJson(data?.balance_data ?? data);
      },
    },
    {
      name: "cloud_servers",
      description:
        "Список всех облачных серверов (VPS) Рег.облака: имя, статус (new/active/off/suspended/archive), ОС (image), тариф (size), CPU (vcpus), память (memory, МБ), диск (disk, ГБ), IPv4/IPv6, PTR, регион, включены ли бэкапы, дата создания.",
      paramsSchema: {},
      handler: async () => {
        const data = (await client.reglets()) as { reglets?: unknown };
        return toJson(data?.reglets ?? data);
      },
    },
    {
      name: "cloud_server",
      description:
        "Подробная информация об одном сервере по id (id взять из cloud_servers): конфигурация, статус, ОС, IP, фактическое использование диска (disk_usage) и т.д.",
      paramsSchema: {
        id: z
          .number()
          .int()
          .positive()
          .describe("Идентификатор сервера (поле id из cloud_servers)"),
      },
      handler: async (args) => {
        const id = args["id"] as number;
        const data = (await client.reglet(id)) as { reglet?: unknown };
        return toJson(data?.reglet ?? data);
      },
    },
    {
      name: "cloud_prices",
      description:
        "Прайс-лист ресурсов Рег.облака: цена за час и за месяц для каждого тарифа/ресурса (reglet, backup, ip, license, snapshot).",
      paramsSchema: {},
      handler: async () => {
        const data = (await client.prices()) as { prices?: unknown };
        return toJson(data?.prices ?? data);
      },
    },
    {
      name: "cloud_snapshots",
      description:
        "Список снэпшотов Рег.облака: имя, размер (size_gigabytes), базовый образ (distribution), минимальный диск для развёртывания, дата создания.",
      paramsSchema: {},
      handler: async () => {
        const data = (await client.snapshots()) as { snapshots?: unknown };
        return toJson(data?.snapshots ?? data);
      },
    },
    {
      name: "cloud_ssh_keys",
      description:
        "Список SSH-ключей, загруженных в Рег.облако: имя, отпечаток (fingerprint), публичный ключ.",
      paramsSchema: {},
      handler: async () => {
        const data = (await client.sshKeys()) as { ssh_keys?: unknown };
        return toJson(data?.ssh_keys ?? data);
      },
    },
  ];
}
