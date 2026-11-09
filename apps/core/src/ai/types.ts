/** Minimal OpenRouter client settings shared by OSS BYOK and hosted cloud. */
export type OpenRouterClientConfig = {
  openRouterApiKey: string;
  openRouterModel: string;
  /** Used as HTTP-Referer for OpenRouter rankings. */
  dashboardUrl: string;
  /** max_tokens for rewrite / summary (default 400). */
  aiRewriteMaxTokens?: number;
};

export function isOpenRouterConfigured(
  config: Pick<OpenRouterClientConfig, "openRouterApiKey">,
): boolean {
  return Boolean(config.openRouterApiKey?.trim());
}
