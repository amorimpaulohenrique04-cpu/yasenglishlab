"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ScheduleBookingError, bookScheduleSessionInputSchema } from "@/modules/schedule";
import { bookCurrentStudentSession } from "@/server/schedule/schedule";

function bookingResultCode(error: ScheduleBookingError): string {
  if (error.code === "ENTITLEMENT_REQUIRED") return "entitlement";
  if (error.code === "FULL") return "full";
  if (error.code === "CLOSED") return "closed";
  return "error";
}

export async function bookLiveSessionAction(formData: FormData): Promise<void> {
  const input = bookScheduleSessionInputSchema.parse({
    liveSessionId: formData.get("liveSessionId"),
  });

  try {
    await bookCurrentStudentSession(input);
  } catch (error) {
    if (error instanceof ScheduleBookingError) {
      redirect(`/agenda?booking=${bookingResultCode(error)}`);
    }
    throw error;
  }

  revalidatePath("/agenda");
  redirect("/agenda?booking=success");
}
