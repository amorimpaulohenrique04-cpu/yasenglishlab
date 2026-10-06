import "server-only";
import { NotificationDeliveryError } from "@/modules/notifications/application/delivery";

type ServerSupabaseEnvironment = Readonly<{
  appUrl: string;
  supabaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  protectedAssetsBucket: string;
}>;

type ServerEnvironmentName =
  | "APP_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_PROTECTED_ASSETS_BUCKET";

function requireServerEnv(name: ServerEnvironmentName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getServerSupabaseEnvironment(): ServerSupabaseEnvironment {
  return {
    appUrl: requireServerEnv("APP_URL"),
    supabaseUrl: requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    protectedAssetsBucket: requireServerEnv("SUPABASE_PROTECTED_ASSETS_BUCKET"),
  };
}

export function getNotificationDeliveryEnvironment():
  { provider: "RESEND"; apiKey: string; fromEmail: string } | { provider: "FAKE" } {
  const provider = process.env.NOTIFICATION_PROVIDER ?? "RESEND";
  if (provider === "FAKE") {
    let local = false;
    try {
      local = ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(process.env.APP_URL ?? "").hostname,
      );
    } catch {
      /* fail closed */
    }
    if (process.env.NODE_ENV === "test" || (process.env.NODE_ENV === "development" && local))
      return { provider: "FAKE" };
  }
  if (provider !== "RESEND" || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    throw new NotificationDeliveryError("INVALID_CONFIG", false);
  return {
    provider: "RESEND",
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  };
}
