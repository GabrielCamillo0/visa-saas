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
  // Use gpt-5-chat por padrão
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

/** Alguns modelos (ex.: gpt-5*) NÃO aceitam temperature/top_p/seed */
function supportsSamplingParams(model: string): boolean {
  // Todos modelos gpt-5 ou gpt-5-* (inclui gpt-5, gpt-5-chat) não aceitam ajustes finos
  return !/^gpt-5(\b|[-_])/.test(model);
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
  model?: string;              // padrão: OPENAI_MODEL ou "gpt-5-chat"
  temperature?: number;        // padrão: 0.2 (ignorado em gpt-5*)
  top_p?: number;              // ignorado em gpt-5*
  seed?: number;               // ignorado em gpt-5*
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
 * - Evita parâmetros proibidos em gpt-5* (temperature/top_p/seed)
 * - Se API retornar 'unsupported_value', refaz a chamada removendo parâmetros
 */
export async function callJSON<T = unknown>(opts: CallJSONOptions<T>): Promise<T> {
  const model       = opts.model ?? defaultModel();
  const samplingOK  = supportsSamplingParams(model);
  const temperature = samplingOK ? (opts.temperature ?? 0.2) : undefined;
  const top_p       = samplingOK ? opts.top_p : undefined;
  const seed        = samplingOK ? opts.seed : undefined;
  const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 120_000);
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

  type CreationParams = {
    model: string;
    input?: any;
    messages?: any;
    temperature?: number;
    top_p?: number;
    seed?: number;
    response_format?: { type: "json_object" };
  };

  // Monta o corpo para Responses API
  const buildResponsesBody = (stripSampling = false): CreationParams => {
    const body: CreationParams = {
      model,
      input: messages,
    };
    if (!stripSampling && samplingOK) {
      if (typeof temperature === "number") body.temperature = temperature;
      if (typeof top_p === "number") body.top_p = top_p;
      if (typeof seed === "number") body.seed = seed;
    }
    // Alguns SDKs aceitam response_format aqui, outros não — se causar erro, o catch cuidará.
    // body.response_format = { type: "json_object" };
    return body;
  };

  // Monta o corpo para Chat Completions
  const buildChatBody = (stripSampling = false): CreationParams => {
    const body: CreationParams = {
      model,
      messages,
      response_format: { type: "json_object" },
    };
    if (!stripSampling && samplingOK) {
      if (typeof temperature === "number") body.temperature = temperature;
      if (typeof top_p === "number") body.top_p = top_p;
      // seed não é amplamente suportado em chat; omitimos por padrão
    }
    return body;
  };

  // Real call (Responses API preferida; Chat como fallback)
  const doCall = async (signal?: AbortSignal): Promise<T> => {
    // ====== Responses API ======
    if (cli?.responses?.create) {
      // 1ª tentativa com os parâmetros calculados
      try {
        const res = await cli.responses.create(buildResponsesBody(false), { signal });
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
      } catch (err: any) {
        const code = err?.code || err?.status || err?.error?.code;
        // Se for erro de parâmetro não suportado (ex.: temperature/top_p em gpt-5), refaça sem sampling
        if (code === "unsupported_value" || /Unsupported value/i.test(err?.message || "")) {
          if (verbose) console.warn("[AI] Retrying Responses API without sampling params due to unsupported_value.");
          const res2 = await cli.responses.create(buildResponsesBody(true), { signal });
          const outText2: string =
            res2.output_text ??
            (Array.isArray(res2.output)
              ? res2.output
                  .flatMap((o: any) => (o?.content || []).map((c: any) => c?.text?.value).filter(Boolean))
                  .join("\n")
              : "");

          if (!outText2 || typeof outText2 !== "string") {
            throw new AIError("Resposta vazia/inesperada da OpenAI (Responses API, retry).", "EMPTY_OUTPUT");
          }

          let parsed2: unknown;
          try {
            parsed2 = JSON.parse(outText2);
          } catch (e) {
            if (verbose) console.error("INVALID_JSON_OUTPUT (Responses, retry):", clipForLog(outText2));
            throw new AIError("Modelo retornou JSON inválido (retry).", "INVALID_JSON", e);
          }

          if (opts.validate) {
            try {
              return opts.validate(parsed2);
            } catch (e) {
              throw new AIError("Falha de validação do payload da IA (retry).", "VALIDATION_ERROR", e);
            }
          }
          return parsed2 as T;
        }
        // Caso não seja unsupported_value, propaga pro loop de retry
        throw err;
      }
    }

    // ====== Chat Completions (fallback) ======
    if (cli?.chat?.completions?.create) {
      try {
        const res = await cli.chat.completions.create(buildChatBody(false) as any, { signal });
        const content: unknown = res?.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
        if (!text) throw new AIError("Resposta vazia/inesperada da OpenAI (Chat Completions).", "EMPTY_OUTPUT");

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
      } catch (err: any) {
        const code = err?.code || err?.status || err?.error?.code;
        if (code === "unsupported_value" || /Unsupported value/i.test(err?.message || "")) {
          if (verbose) console.warn("[AI] Retrying Chat API without sampling params due to unsupported_value.");
          const res2 = await cli.chat.completions.create(buildChatBody(true) as any, { signal });
          const content2: unknown = res2?.choices?.[0]?.message?.content;
          const text2 = typeof content2 === "string" ? content2 : JSON.stringify(content2 ?? "");
          if (!text2) throw new AIError("Resposta vazia/inesperada da OpenAI (Chat Completions, retry).", "EMPTY_OUTPUT");

          let parsed2: unknown;
          try {
            parsed2 = JSON.parse(text2);
          } catch (e) {
            if (verbose) console.error("INVALID_JSON_OUTPUT (Chat, retry):", clipForLog(text2));
            throw new AIError("Modelo retornou JSON inválido (retry).", "INVALID_JSON", e);
          }

          if (opts.validate) {
            try {
              return opts.validate(parsed2);
            } catch (e) {
              throw new AIError("Falha de validação do payload da IA (retry).", "VALIDATION_ERROR", e);
            }
          }
          return parsed2 as T;
        }
        throw err;
      }
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
          `[AI] callJSON attempt=${attempt} model=${model} temp=${samplingOK ? (opts.temperature ?? 0.2) : "-"} seed=${samplingOK ? (opts.seed ?? "-") : "-"}\n` +
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

      const asAI =
        e instanceof AIError ? e : new AIError(String(e?.message || e), String(code), e);

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
        asAI.code === "NO_API_METHOD" ||
        asAI.code === "unsupported_value" // já lidamos internamente — se sobrou, não retry
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
