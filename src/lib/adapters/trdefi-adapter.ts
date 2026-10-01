import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://yield.trdefi.com";

/**
 * TRDEFI Liquidity — a keyless, read-only stablecoin liquidity catalogue.
 *
 * Every operation is a GET against the public API, so there is no credential to
 * resolve: the adapter ignores BYOK and the master pool entirely, and nothing
 * here signs, broadcasts or moves a token. Cost is 0 — the reads are free.
 */
export const trdefiAdapter: ToolAdapter = {
  slug: "trdefi",
  name: "TRDEFI Liquidity",
  description:
    "Live non-custodial stablecoin liquidity — open USDC/USDT maker positions across 20 networks, the live networks, and an on-chain swap quote at the current block. Free, no key.",
  operations: ["stats", "chains", "positions", "position", "quote"],

  async execute(
    operation: string,
    input: Record<string, unknown>
  ): Promise<AdapterResult> {
    try {
      if (operation === "stats") {
        return await get("/api/stats");
      }

      if (operation === "chains") {
        return await get("/api/chains");
      }

      if (operation === "positions") {
        const params = new URLSearchParams();
        if (input.chain) params.set("chain", String(input.chain));
        if (input.pair) params.set("pair", String(input.pair));
        params.set("limit", String((input.limit as number) ?? 50));
        return await get(`/api/strategies?${params.toString()}`);
      }

      if (operation === "position") {
        const hash = input.hash as string;
        if (!hash) {
          return {
            success: false,
            error: "Missing required field: hash",
            provider: "trdefi",
          };
        }
        return await get(
          `/api/strategy-detail?hash=${encodeURIComponent(hash)}`
        );
      }

      if (operation === "quote") {
        const hash = input.hash as string;
        const amount = input.amount as string;
        if (!hash || !amount) {
          return {
            success: false,
            error: "Missing required fields: hash, amount",
            provider: "trdefi",
          };
        }
        const params = new URLSearchParams({
          hash,
          amount: String(amount),
          chain: String(input.chain ?? "ethereum"),
        });
        if (input.direction) params.set("direction", String(input.direction));
        return await get(`/api/quote?${params.toString()}`);
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "trdefi",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "trdefi" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/stats`, {
        method: "GET",
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0;
  },
};

async function get(path: string): Promise<AdapterResult> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: 30_000,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return {
      success: false,
      error: `TRDEFI ${path} failed: ${res.status} ${errText}`,
      provider: "trdefi",
    };
  }

  const data = await res.json();
  return { success: true, data, provider: "trdefi" };
}
