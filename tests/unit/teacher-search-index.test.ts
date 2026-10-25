import { describe, expect, it } from "vitest";
import {
  capTeacherSearchIndex,
  emptyTeacherSearchIndex,
  type TeacherSearchIndex,
} from "@/modules/teacher-operations/domain/search-index";

function index(students: number, cohorts: number, reviews: number): TeacherSearchIndex {
  return {
    students: Array.from({ length: students }, (_, i) => ({
      id: `s${i}`,
      name: `Student ${i}`,
      cohortNames: [],
      href: `/teacher/alunos/s${i}`,
    })),
    cohorts: Array.from({ length: cohorts }, (_, i) => ({
      id: `c${i}`,
      name: `Cohort ${i}`,
      href: `/teacher/turmas/c${i}`,
    })),
    reviews: Array.from({ length: reviews }, (_, i) => ({
      id: `r${i}`,
      title: `Review ${i}`,
      kind: "practice" as const,
      href: `/teacher/revisoes/r${i}`,
    })),
  };
}

describe("teacher search index", () => {
  it("has an empty shape with the three groups", () => {
    expect(emptyTeacherSearchIndex).toEqual({ students: [], cohorts: [], reviews: [] });
  });

  it("caps the total and reserves a quarter each for cohorts and reviews", () => {
    const capped = capTeacherSearchIndex(index(500, 500, 500), 200);
    expect(capped.cohorts).toHaveLength(50);
    expect(capped.reviews).toHaveLength(50);
    expect(capped.students).toHaveLength(100);
    expect(capped.students.length + capped.cohorts.length + capped.reviews.length).toBe(200);
  });

  it("gives unused cohort and review share to students", () => {
    const capped = capTeacherSearchIndex(index(500, 3, 0), 200);
    expect(capped.cohorts).toHaveLength(3);
    expect(capped.reviews).toHaveLength(0);
    expect(capped.students).toHaveLength(197);
  });

  it("keeps small indexes untouched and preserves order", () => {
    const small = index(2, 1, 1);
    expect(capTeacherSearchIndex(small)).toEqual(small);
  });

  it("never returns a negative student window", () => {
    expect(capTeacherSearchIndex(index(5, 5, 5), 0)).toEqual(emptyTeacherSearchIndex);
  });
});
