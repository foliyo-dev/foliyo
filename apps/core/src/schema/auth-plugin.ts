import {
  IntegrityError,
  type MeshPlugin,
  type PluginContext,
  verifyQuerySignature,
} from "meshql-core";
import {
  deriveSigningToken,
  injectAuthContext,
  isTokenExpired,
  parseWireToken,
  type IntegrityConfig,
} from "meshql-integrity";
import { bearerToken, getTokenUserId } from "../auth/tokens.js";
import type { FoliyoDb } from "../db.js";

export type FoliyoMeshAuthOptions = {
  db: FoliyoDb;
  /** When set, Mesh integrity tokens (X-Mesh-Token + signature) are accepted. */
  integrity?: IntegrityConfig;
  /**
   * When true, every Mesh query must carry a valid Mesh signature
   * (dashboard meshql-client mode). Public unsigned reads are rejected.
   * Default false — Foliyo Bearer or anonymous public reads still work.
   */
  requireSigned?: boolean;
};

/**
 * Auth bridge for /mesh:
 * 1. Signed Mesh integrity token (preferred when present)
 * 2. Foliyo `Authorization: Bearer` session token
 * 3. Anonymous (public row filters apply)
 */
export function foliyoMeshAuthPlugin(options: FoliyoMeshAuthOptions): MeshPlugin {
  return {
    name: "foliyo-mesh-auth",
    async onRequest(raw, ctx) {
      const transport = ctx.transport;
      const hasMeshAuth = Boolean(transport?.token && transport?.signature && transport?.queryHeader);

      if (hasMeshAuth && options.integrity) {
        verifyMeshIntegrity(options.integrity, ctx);
        return raw;
      }

      if (options.requireSigned) {
        throw new IntegrityError("Missing X-Mesh-Token / X-Mesh-Signature for verification");
      }

      const userId = await resolveFoliyoBearer(options.db, transport?.headers);
      if (userId) {
        ctx.queryContext.userId = userId;
      }
      return raw;
    },
  };
}

function verifyMeshIntegrity(config: IntegrityConfig, ctx: PluginContext): void {
  const transport = ctx.transport;
  if (!transport?.queryHeader || !transport.token || !transport.signature) {
    throw new IntegrityError("Missing Mesh integrity headers");
  }

  let payload;
  try {
    payload = parseWireToken(transport.token);
  } catch {
    throw new IntegrityError("Unknown or invalid token");
  }

  if (isTokenExpired(payload.expiresAt)) {
    throw new IntegrityError("Signing token expired", { code: "TOKEN_EXPIRED" });
  }
  if (config.store.isRevoked(payload.sessionId)) {
    throw new IntegrityError("Unknown or invalid token");
  }

  const session = config.store.get(payload.sessionId);
  const signingToken =
    session?.signingToken ??
    deriveSigningToken(config.secret, payload.userId, payload.sessionId, payload.expiresAt);

  const valid = verifyQuerySignature(signingToken, transport.queryHeader, transport.signature);
  if (!valid) {
    throw new IntegrityError("Signature verification failed");
  }

  injectAuthContext(ctx.queryContext, payload);
}

async function resolveFoliyoBearer(
  db: FoliyoDb,
  headers: Record<string, string> | undefined,
): Promise<string | null> {
  if (!headers) return null;
  const auth =
    headers.authorization ??
    headers.Authorization ??
    Object.entries(headers).find(([k]) => k.toLowerCase() === "authorization")?.[1];
  const token = bearerToken(auth);
  if (!token) return null;
  return getTokenUserId(db, token);
}
