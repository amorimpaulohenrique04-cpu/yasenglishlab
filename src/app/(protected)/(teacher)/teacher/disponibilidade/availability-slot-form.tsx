"use client";

import { Button } from "@/components/ui";
import { localAvailabilityToIso } from "@/modules/teacher-operations";
import { saveAvailabilityAction } from "./actions";

export function AvailabilitySlotForm({
  id,
  operation,
  startsAt,
  endsAt,
}: {
  id?: string;
  operation: "CREATE" | "EDIT";
  startsAt?: string;
  endsAt?: string;
}) {
  function submit(form: HTMLFormElement) {
    const date = (form.elements.namedItem("slot_date") as HTMLInputElement).value;
    const start = (form.elements.namedItem("start_time") as HTMLInputElement).value;
    const end = (form.elements.namedItem("end_time") as HTMLInputElement).value;
    if (!date || !start || !end) return;
    (form.elements.namedItem("starts_at") as HTMLInputElement).value = localAvailabilityToIso(
      date,
      start,
    );
    (form.elements.namedItem("ends_at") as HTMLInputElement).value = localAvailabilityToIso(
      date,
      end,
    );
  }

  const format = (value?: string) => {
    if (!value) return { date: "", time: "" };
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Recife",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      time: `${part("hour")}:${part("minute")}`,
    };
  };
  const start = format(startsAt);
  const end = format(endsAt);

  return (
    <form
      action={saveAvailabilityAction}
      className="yas-availability-form"
      onSubmit={(event) => submit(event.currentTarget)}
    >
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="starts_at" />
      <input type="hidden" name="ends_at" />
      <label>
        Data
        <input name="slot_date" type="date" defaultValue={start.date} required />
      </label>
      <label>
        Início
        <input name="start_time" type="time" defaultValue={start.time} required />
      </label>
      <label>
        Término
        <input name="end_time" type="time" defaultValue={end.time} required />
      </label>
      <Button type="submit">
        {operation === "CREATE" ? "Adicionar horário" : "Salvar horário"}
      </Button>
    </form>
  );
}
