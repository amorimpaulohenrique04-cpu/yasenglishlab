import { z } from "zod";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePageRole } from "@/server/auth/guards";
import { loadSessionResources } from "@/server/teacher-operations/resources";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { SessionResources } from "@/modules/teacher-operations/ui/session-resources";
import { JoinMeeting } from "@/modules/schedule/ui/join-meeting";
import { joinLiveSessionAction, studentResourceAccessAction } from "../actions";
export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const actor = await requirePageRole("STUDENT");
  const id = z.uuid().parse((await params).sessionId);
  const client = await createSupabaseServerClient();
  const { data: booking } = await client
    .from("session_bookings")
    .select("id")
    .eq("live_session_id", id)
    .eq("user_id", actor.userId)
    .eq("status", "BOOKED")
    .maybeSingle();
  if (!booking) notFound();
  const { data: session } = await client
    .from("live_sessions")
    .select("id,title")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const resources = await loadSessionResources(id);
  return (
    <>
      <PageHeader title={session.title} description="Seu encontro, recursos e tarefas." />
      <JoinMeeting sessionId={id} action={joinLiveSessionAction} />
      <SessionResources resources={resources} action={studentResourceAccessAction} />
    </>
  );
}
