import { describe, expect, it } from "vitest";
import { assertCanonicalPractice } from "../../scripts/_canonical-practice-proof.mjs";

const proof = () => ({
  result: {
    score: 6,
    max_score: 7,
    metrics: { itemCount: 7, firstTryCorrect: 6, recovered: 0, missed: 1, pendingManual: 0 },
  },
  responses: ["greet-1", "greet-2", "be-1", "ps-1", "ps-2", "ps-3", "order-1"].map((id) => ({
    item_id: id,
    round: 1,
    evaluation_status: id === "ps-1" ? "INCORRECT" : "CORRECT",
  })),
});

describe("canonical practice release proof (ADR 0025)", () => {
  it("accepts seven final answers with one deliberate mistake and no reinforcement round", () => {
    expect(() => assertCanonicalPractice(proof())).not.toThrow();
  });

  it.each(["score", "max_score"] as const)("rejects incorrect %s", (key) => {
    const value = proof();
    value.result[key] = 0;
    expect(() => assertCanonicalPractice(value)).toThrow();
  });

  it.each(["itemCount", "firstTryCorrect", "recovered", "missed", "pendingManual"] as const)(
    "rejects incorrect %s metrics even if rows and scores match",
    (key) => {
      const value = proof();
      value.result.metrics[key] += 1;
      expect(() => assertCanonicalPractice(value)).toThrow();
    },
  );

  it("rejects the obsolete eight-response proof", () => {
    const value = proof();
    value.result.metrics.recovered = 1;
    value.responses.push({ item_id: "ps-1", round: 2, evaluation_status: "CORRECT" });
    expect(() => assertCanonicalPractice(value)).toThrow();
  });

  it("rejects a missing item replaced by a duplicate despite the correct row count", () => {
    const value = proof();
    value.responses[6] = { ...value.responses[0]! };
    expect(() => assertCanonicalPractice(value)).toThrow();
  });

  it.each(["missing", "extra", "round", "verdict"])("rejects %s responses", (mutation) => {
    const value = proof();
    if (mutation === "missing") value.responses.pop();
    if (mutation === "extra") value.responses.push({ ...value.responses[0]! });
    if (mutation === "round") value.responses[0]!.round = 2;
    if (mutation === "verdict") value.responses[3]!.evaluation_status = "CORRECT";
    expect(() => assertCanonicalPractice(value)).toThrow();
  });
});
