// Thin read-only HTTP client for the Reg.ru CloudVPS API.
// Docs: https://developers.cloudvps.reg.ru (base: https://api.cloudvps.reg.ru)

const DEFAULT_BASE_URL = "https://api.cloudvps.reg.ru";
const REQUEST_TIMEOUT_MS = 30_000;

export class CloudApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "CloudApiError";
    this.status = status;
  }
}

export class CloudClient {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  async get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      // Never expose the token: the message only names the endpoint.
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new CloudApiError(
          `Таймаут запроса к ${path} (${REQUEST_TIMEOUT_MS / 1000} с) — api.cloudvps.reg.ru не отвечает`
        );
      }
      throw new CloudApiError(
        `Не удалось подключиться к api.cloudvps.reg.ru (${path}): ${
          cause instanceof Error ? cause.message : String(cause)
        }`
      );
    }

    const bodyText = await response.text();
    let body: unknown = undefined;
    try {
      body = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      // non-JSON body — keep raw text for the error path below
    }

    if (!response.ok) {
      throw new CloudApiError(describeHttpError(path, response.status, body, bodyText), response.status);
    }

    return body as T;
  }

  // --- Read-only endpoints (official docs) ---

  /** GET /v1/balance_data — баланс, прогноз расходов, детализация потребления */
  balanceData(): Promise<unknown> {
    return this.get("/v1/balance_data");
  }

  /** GET /v1/reglets — список всех серверов */
  reglets(): Promise<unknown> {
    return this.get("/v1/reglets");
  }

  /** GET /v1/reglets/<id> — информация об одном сервере */
  reglet(id: number | string): Promise<unknown> {
    return this.get(`/v1/reglets/${encodeURIComponent(String(id))}`);
  }

  /** GET /v1/prices — прайс-лист ресурсов */
  prices(): Promise<unknown> {
    return this.get("/v1/prices");
  }

  /** GET /v1/snapshots — список снэпшотов */
  snapshots(): Promise<unknown> {
    return this.get("/v1/snapshots");
  }

  /** GET /v1/account/keys — список SSH-ключей */
  sshKeys(): Promise<unknown> {
    return this.get("/v1/account/keys");
  }
}

function describeHttpError(path: string, status: number, body: unknown, rawText: string): string {
  const apiMessage =
    extractApiMessage(body) ?? (rawText && rawText.length <= 300 ? rawText : undefined);

  switch (status) {
    case 401:
      return `Ошибка авторизации (401) при запросе ${path}: токен неверный, отозван или не имеет доступа к «Облачным VPS». Проверьте REGRU_CLOUD_TOKEN в настройках MCP-клиента.${apiMessage ? ` API: ${apiMessage}` : ""}`;
    case 403:
      return `Доступ запрещён (403) при запросе ${path}. Токен не даёт доступа к этому ресурсу.${apiMessage ? ` API: ${apiMessage}` : ""}`;
    case 404:
      return `Не найдено (404): ${path}. Если запрашивали сервер по id — проверьте id через cloud_servers.${apiMessage ? ` API: ${apiMessage}` : ""}`;
    case 429:
      return `Слишком много запросов (429) — лимит API. Повторите позже.${apiMessage ? ` API: ${apiMessage}` : ""}`;
    default:
      if (status >= 500) {
        return `Сервер Reg.ru временно недоступен (HTTP ${status}) при запросе ${path}. Повторите позже.${apiMessage ? ` API: ${apiMessage}` : ""}`;
      }
      return `Ошибка HTTP ${status} при запросе ${path}${apiMessage ? `: ${apiMessage}` : ""}`;
  }
}

function extractApiMessage(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const candidates = ["message", "error", "description", "error_description"];
  for (const key of candidates) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== null && typeof value === "object") {
      const nested = extractApiMessage(value);
      if (nested) return nested;
    }
  }
  return undefined;
}
