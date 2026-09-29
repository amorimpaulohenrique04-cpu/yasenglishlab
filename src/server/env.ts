import "server-only";

type ServerSupabaseEnvironment = Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
}>;

function requireServerEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getServerSupabaseEnvironment(): ServerSupabaseEnvironment {
  return {
    supabaseUrl: requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
