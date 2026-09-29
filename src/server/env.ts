import "server-only";

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
