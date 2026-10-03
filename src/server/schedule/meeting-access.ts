import "server-only";
import { z } from "zod";
import type {
  JoinAccess,
  MeetingProviderPort,
} from "@/modules/schedule/application/meeting-provider";
import { manualMeetingUrlSchema } from "@/modules/teacher-operations/domain/session-input";
import { assertAuthenticated } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export class ManualExternalMeetingProvider implements MeetingProviderPort {
  async getJoinAccess(sessionId: string): Promise<JoinAccess> {
    await assertAuthenticated();
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("get_live_session_join_access", {
      p_session_id: z.uuid().parse(sessionId),
    });
    if (error) throw new Error("Não foi possível consultar o acesso ao encontro.");
    if (data?.status === "AVAILABLE")
      return { status: "AVAILABLE", url: manualMeetingUrlSchema.parse(data.url) };
    const status = z
      .enum(["NOT_AUTHORIZED", "TOO_EARLY", "MEETING_NOT_READY", "SESSION_CLOSED"])
      .parse(data?.status);
    return { status };
  }
}
export async function getLiveSessionJoinAccess(sessionId: string) {
  return new ManualExternalMeetingProvider().getJoinAccess(sessionId);
}
