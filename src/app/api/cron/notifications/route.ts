import { handleNotificationsCron } from "@/server/notifications/cron-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Common cron hosts call with GET (Authorization: Bearer) or POST.
export async function GET(request: Request): Promise<Response> {
  return handleNotificationsCron(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleNotificationsCron(request);
}
