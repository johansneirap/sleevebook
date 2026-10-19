import { z } from "zod";

// Unset and empty ("FOO=") both mean "not configured"; values are trimmed
// (stray spaces from pasting into the hosting dashboard).
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  PUBLIC_ASSETS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().min(1),
  // Google OAuth (the only sign-in method in production). Optional so local
  // dev and CI run without it; /entrar explains when it isn't configured.
  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  // The first account created with this email inherits the pre-login data
  // owned by DEV_USER_ID (see lib/auth.ts).
  OWNER_EMAIL: optional(z.email()),
  // "1" enables an email+password login for local dev and e2e. Ignored in
  // production builds.
  AUTH_DEV_LOGIN: optional(z.string()),
  // Fase 5: camera scanning through Claude Vision. Without a key /escanear
  // explains it's not configured.
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  // Scans per user per day (cost cap).
  SCAN_DAILY_LIMIT: optional(z.coerce.number().int().positive()),
});

export const env = envSchema.parse(process.env);
