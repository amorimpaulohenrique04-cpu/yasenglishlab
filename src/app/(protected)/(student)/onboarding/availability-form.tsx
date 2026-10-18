import { Button, Input, Select } from "@/components/ui";
import { weekdays, minuteLabel, type SchedulePreference } from "@/modules/placement";
import { savePreferencesAction } from "./actions";

/** Weekly availability form shared by the onboarding steps and the "no compatible cohort" state. */
export function AvailabilityForm({
  preference,
  invalid,
  primary,
  returnTo,
}: {
  preference: SchedulePreference | undefined;
  invalid: boolean;
  primary: boolean;
  returnTo?: "placement";
}) {
  return (
    <form action={savePreferencesAction} className="yas-stack">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Input
        label="Fuso horário"
        name="timezone"
        defaultValue={preference?.timezone ?? "America/Recife"}
        required
        tone={invalid ? "error" : "default"}
        message={
          invalid
            ? "Confira seu fuso, por exemplo America/Recife."
            : "Exemplo: America/Recife. Use o fuso da sua disponibilidade."
        }
      />
      <Select
        name="weekday"
        label="Dia disponível"
        options={weekdays.map((label, value) => ({ label, value: String(value) }))}
        defaultValue={String(preference?.weekday ?? 1)}
      />
      <Input
        name="start"
        label="Disponível a partir de"
        tone={invalid ? "error" : "default"}
        message={invalid ? "Confira o intervalo: o início deve vir antes do fim." : ""}
        type="time"
        required
        defaultValue={minuteLabel(preference?.startMinute ?? 1080)}
      />
      <Input
        name="end"
        label="Disponível até"
        tone={invalid ? "error" : "default"}
        message={invalid ? "Informe um fim posterior ao início." : ""}
        type="time"
        required
        defaultValue={minuteLabel(preference?.endMinute ?? 1260)}
      />
      <Button type="submit" variant={primary ? "primary" : "secondary"}>
        Salvar disponibilidade
      </Button>
    </form>
  );
}
