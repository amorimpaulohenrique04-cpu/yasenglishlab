import { describe, expect, it } from "vitest";

import { adminContentFormToPayload } from "@/modules/admin-content/application/form-data";
import { adminContentSaveSchemas } from "@/modules/admin-content/domain/models";

const moduleForm = (audience?: string) => {
  const form = new FormData();
  form.set("course_id", "40000000-0000-4000-8000-000000000001");
  form.set("position", "1");
  form.set("title", "Módulo");
  form.set("description", "");
  if (audience !== undefined) form.set("audience", audience);
  return form;
};

describe("admin content audience", () => {
  it("defaults the audience to COURSE when the form does not send one", () => {
    expect(adminContentFormToPayload("modules", moduleForm()).audience).toBe("COURSE");
  });

  it("carries COHORTS from the form for modules, lessons and materials", () => {
    const form = moduleForm("COHORTS");
    expect(adminContentFormToPayload("modules", form).audience).toBe("COHORTS");
    expect(adminContentFormToPayload("lessons", form).audience).toBe("COHORTS");
    expect(adminContentFormToPayload("materials", form).audience).toBe("COHORTS");
  });

  it("accepts COURSE and COHORTS and rejects other values, including ASSIGNED", () => {
    const base = adminContentFormToPayload("modules", moduleForm("COHORTS"));
    expect(adminContentSaveSchemas.modules.safeParse(base).success).toBe(true);
    expect(adminContentSaveSchemas.modules.safeParse({ ...base, audience: "COURSE" }).success).toBe(
      true,
    );
    expect(
      adminContentSaveSchemas.modules.safeParse({ ...base, audience: "ASSIGNED" }).success,
    ).toBe(false);
    expect(
      adminContentSaveSchemas.modules.safeParse({ ...base, audience: "SPECIAL" }).success,
    ).toBe(false);
  });

  it("keeps courses strict: audience is not a course field", () => {
    expect(
      adminContentSaveSchemas.courses.safeParse({
        slug: "x",
        title: "X",
        description: null,
        active: true,
        audience: "COHORTS",
      }).success,
    ).toBe(false);
  });
});
