import { describe, expect, it } from "vitest";
import { nameInitials } from "@/lib/initials";

describe("nameInitials", () => {
  it("uses the first letters of the first two names, uppercased", () => {
    expect(nameInitials("ana maria silva", "?")).toBe("AM");
  });
  it("returns one initial for a single name", () => {
    expect(nameInitials("Yasminn", "?")).toBe("Y");
  });
  it("ignores extra surrounding and inner whitespace", () => {
    expect(nameInitials("   ana    maria  ", "?")).toBe("AM");
  });
  it("returns the fallback for empty or blank names", () => {
    expect(nameInitials("", "?")).toBe("?");
    expect(nameInitials("   ", "YL")).toBe("YL");
  });
});
