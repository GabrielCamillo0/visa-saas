// src/lib/openai.ts
import OpenAI from "openai";
import { requireOpenAIKey } from "./requireOpenAIKey";

/** Erro amigável para camada de IA (com código opcional) */
export class AIError extends Error {
  code?: string;
  cause?: unknown;
  constructor(message: string, code?: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

/** Modelo default (pode sobrepor via parâmetro) */
function defaultModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5";
}

/** Sanitiza texto para logs (limita tamanho) */
function clipForLog(v: unknown, max = 2000): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2);
  return s.length > max ? `${s.slice(0, max)}…[+${s.length - max} chars]` : s;
}

/** Lista de códigos que valem retry */
function isRetryable(code?: number | string): boolean {
  const n = typeof code === "string" ? Number(code) : code;
  if (!n) return false;
  return (
    n === 408 || // timeout
    n === 409 || // conflict
    n === 425 || // too early
    n === 429 || // rate limit
    (n >= 500 && n <= 599)
  );
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (process.env.AI_MOCK === "1") {
    throw new AIError(
      "AI_MOCK=1 detectado — modo de mock está ativo. Desative para usar a IA real.",
      "AI_MOCK_ACTIVE"
    );
  }
  if (!client) client = new OpenAI({ apiKey: requireOpenAIKey() });
  return client;
}

type CallJSONOptions<TOut> = {
  system: string;
  user: unknown;               // string ou objeto
  model?: string;              // padrão: OPENAI_MODEL ou "gpt-4o-mini"
  temperature?: number;        // padrão: 0.2
  top_p?: number;              // default undefined
  seed?: number;               // quando suportado (Responses API)
  timeoutMs?: number;          // padrão: 60_000
  maxRetries?: number;         // padrão: 2 tentativas (total 3)
  validate?: (data: unknown) => TOut; // ex.: zod.parse
  /** Quando true, loga inputs/outputs e erros (até limite). Padrão: NODE_ENV!=="production" */
  verboseLog?: boolean;
};

/**
 * Chama o modelo e OBRIGA resposta JSON válida.
 * - Sem mock silencioso
 * - Sem “regex” para salvar JSON quebrado
 * - Com timeout + retries (apenas erros transitórios)
 * - Validação opcional (ex.: Zod)
 */
export async function callJSON<T = unknown>(opts: CallJSONOptions<T>): Promise<T> {
  const model       = opts.model ?? defaultModel();
  const temperature = opts.temperature ?? 0.2;
  const top_p       = opts.top_p;
  const seed        = opts.seed;
  const timeoutMs   = opts.timeoutMs ?? 60_000;
  const maxRetries  = Math.max(0, opts.maxRetries ?? 2);
  const verbose     = opts.verboseLog ?? process.env.NODE_ENV !== "production";

  const cli: any = getClient();

  // Monta mensagens
  const messages = [
    { role: "system" as const, content: `${opts.system}\nResponda APENAS em JSON válido.` },
    {
      role: "user" as const,
      content: typeof opts.user === "string" ? opts.user : JSON.stringify(opts.user ?? {}),
    },
  ];

  // Real call (Responses API preferida; Chat como fallback)
  const doCall = async (signal?: AbortSignal): Promise<T> => {
    // Responses API
    if (cli?.responses?.create) {
      // ⚠️ 'signal' vai no SEGUNDO argumento (options), não dentro do body
      const res = await cli.responses.create(
        {
          model,
          temperature,
          ...(typeof top_p === "number" ? { top_p } : {}),
          ...(typeof seed === "number" ? { seed } : {}),
          input: messages,
          // Se seu SDK suportar schema/response_format para JSON:
          // response_format: { type: "json_object" },
        },
        { signal } // ✅ aqui!
      );

      const outText: string =
        res.output_text ??
        (Array.isArray(res.output)
          ? res.output
              .flatMap((o: any) => (o?.content || []).map((c: any) => c?.text?.value).filter(Boolean))
              .join("\n")
          : "");

      if (!outText || typeof outText !== "string") {
        throw new AIError("Resposta vazia/inesperada da OpenAI (Responses API).", "EMPTY_OUTPUT");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(outText);
      } catch (e) {
        if (verbose) console.error("INVALID_JSON_OUTPUT (Responses):", clipForLog(outText));
        throw new AIError("Modelo retornou JSON inválido.", "INVALID_JSON", e);
      }

      if (opts.validate) {
        try {
          return opts.validate(parsed);
        } catch (e) {
          throw new AIError("Falha de validação do payload da IA.", "VALIDATION_ERROR", e);
        }
      }
      return parsed as T;
    }

    // Chat Completions (fallback)
    if (cli?.chat?.completions?.create) {
      const res = await cli.chat.completions.create(
        {
          model,
          temperature,
          ...(typeof top_p === "number" ? { top_p } : {}),
          response_format: { type: "json_object" },
          messages,
        },
        { signal } // ✅ aqui também!
      );

      const content: unknown = res?.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
      if (!text) {
        throw new AIError("Resposta vazia/inesperada da OpenAI (Chat Completions).", "EMPTY_OUTPUT");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        if (verbose) console.error("INVALID_JSON_OUTPUT (Chat):", clipForLog(text));
        throw new AIError("Modelo retornou JSON inválido.", "INVALID_JSON", e);
      }

      if (opts.validate) {
        try {
          return opts.validate(parsed);
        } catch (e) {
          throw new AIError("Falha de validação do payload da IA.", "VALIDATION_ERROR", e);
        }
      }
      return parsed as T;
    }

    throw new AIError("SDK OpenAI sem Responses e sem Chat Completions disponíveis.", "NO_API_METHOD");
  };

  // Retry com backoff exponencial + jitter
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (verbose) {
        console.info(
          `[AI] callJSON attempt=${attempt} model=${model} temp=${temperature} seed=${seed ?? "-"}\n` +
          `system=${clipForLog(opts.system, 500)}\n` +
          `user=${clipForLog(opts.user, 1000)}`
        );
      }

      const out = await doCall(controller.signal);

      if (verbose) console.info(`[AI] callJSON OK attempt=${attempt}`);
      return out;
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;

      const code =
        e?.code ||
        e?.status ||
        e?.error?.code ||
        (e?.cause && (e.cause.code || e.cause?.status));

      const asAI = e instanceof AIError ? e : new AIError(String(e?.message || e), String(code), e);

      if (verbose) {
        console.error(
          `[AI] callJSON FAIL attempt=${attempt} code=${asAI.code ?? "-"} message=${asAI.message}`
        );
      }

      // Erros não-retryáveis
      if (
        asAI.code === "INVALID_JSON" ||
        asAI.code === "VALIDATION_ERROR" ||
        asAI.code === "NO_API_KEY" ||
        asAI.code === "AI_MOCK_ACTIVE" ||
        asAI.code === "NO_API_METHOD"
      ) {
        throw asAI;
      }

      // Retentativa só para erros transitórios
      if (!isRetryable(Number(asAI.code))) {
        throw asAI;
      }

      // backoff exponencial + jitter
      const base = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s...
      const jitter = Math.floor(Math.random() * 250);
      const delay = Math.min(base + jitter, 4000);

      attempt++;
      if (attempt > maxRetries) {
        if (verbose) console.error("[AI] callJSON giving up after retries.");
        throw asAI;
      }
      await new Promise((r) => setTimeout(r, delay));
      continue;
    } finally {
      clearTimeout(t);
    }
  }

  // Salvaguarda
  throw new AIError("Falha desconhecida ao chamar OpenAI.", "UNKNOWN");
}
