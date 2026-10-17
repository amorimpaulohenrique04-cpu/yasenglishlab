import { describe, expect, it } from "vitest";
import { reviewSlaStatus } from "@/modules/placement";

const now = new Date("2026-10-17T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("reviewSlaStatus", () => {
  it("classifies on time, approaching and overdue at the boundaries", () => {
    expect(reviewSlaStatus(ago(1), now).status).toBe("ON_TIME");
    expect(reviewSlaStatus(ago(19.9), now).status).toBe("ON_TIME");
    expect(reviewSlaStatus(ago(20), now).status).toBe("APPROACHING");
    expect(reviewSlaStatus(ago(23.9), now).status).toBe("APPROACHING");
    expect(reviewSlaStatus(ago(24), now).status).toBe("OVERDUE");
  });
  it("never reports negative elapsed time", () => {
    expect(reviewSlaStatus(ago(-2), now).hours).toBe(0);
  });
});
