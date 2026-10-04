import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { loginCanonicalTeacher } from "../../../tests/helpers/teacher-mfa.ts";
import { loginCanonicalAdmin } from "../../../tests/helpers/admin-mfa.ts";
const browser = await chromium.launch();
const reports = [];
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const pending = users.users.find((u) => u.email === "canonical.placement-pending@example.test");
const { data: placement } = await admin
  .from("placement_cases")
  .select("id")
  .eq("user_id", pending.id)
  .single();
for (const [actor, width] of [
  ["student", 1440],
  ["student", 390],
  ["teacher", 1440],
  ["admin", 390],
]) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  const navigations = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navigations.push(f.url());
  });
  if (actor === "teacher") await loginCanonicalTeacher(page, process.env.CANONICAL_E2E_PASSWORD);
  else if (actor === "admin") await loginCanonicalAdmin(page, process.env.CANONICAL_E2E_PASSWORD);
  else {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("canonical.placement-resume@example.test");
    await page.getByLabel("Senha").fill(process.env.CANONICAL_E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/home");
  }
  await page.addInitScript(() => {
    // Controlled slow-frame simulation widens the server-stream reveal window.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => setTimeout(() => callback(time), 2000));
    window.__events = [];
    const original = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      window.__events.push({
        event: "focus-call",
        tag: this.tagName,
        id: this.id,
        stack: new Error().stack,
      });
      return original.apply(this, args);
    };
    for (const name of ["focusin", "focusout"])
      document.addEventListener(name, (e) =>
        window.__events.push({
          event: name,
          tag: e.target.tagName,
          id: e.target.id,
          time: performance.now(),
        }),
      );
  });
  for (let attempt = 0; attempt < 1; attempt++) {
    await page.goto(
      actor === "student"
        ? "/onboarding/assessment"
        : actor === "teacher"
          ? `/teacher/revisoes/placement/${placement.id}`
          : "/admin/enrollments",
    );
    const first = page.getByLabel(
      actor === "student"
        ? "Sua resposta"
        : actor === "teacher"
          ? "Feedback para o aluno"
          : "Filtrar por etapa",
    );
    const before = await first.evaluate((el) => {
      const snapshot = {
        id: el.id,
        visible: el.getClientRects().length > 0,
        hiddenAncestor: el.closest("[hidden]")?.outerHTML.slice(0, 250),
        active: document.activeElement?.tagName,
      };
      el.focus();
      return { ...snapshot, atomicFocus: document.activeElement === el };
    });
    await first.focus();
    const handle = await first.elementHandle();
    const initial = await handle.evaluate((el) => ({
      tag: el.tagName,
      id: el.id,
      connected: el.isConnected,
      active: document.activeElement === el,
      disabled: el.matches(":disabled"),
      inert: !!el.closest("[inert]"),
      html: el.outerHTML,
    }));
    if (actor !== "student") await page.keyboard.press("Tab");
    // Observation window only: no assertion/retry or proposed test synchronization.
    await page.waitForTimeout(3000);
    const after = await handle.evaluate((el) => ({
      connected: el.isConnected,
      active: document.activeElement === el,
      activeHTML: document.activeElement?.outerHTML.slice(0, 600),
    }));
    const current = await first.evaluate((el) => ({
      id: el.id,
      active: document.activeElement === el,
      disabled: el.matches(":disabled"),
      inert: !!el.closest("[inert]"),
    }));
    await first.focus();
    if (actor !== "student") await page.keyboard.press("Tab");
    const settled = await page.evaluate(() => ({
      active: document.activeElement?.outerHTML,
      events: window.__events,
      loading: [...document.querySelectorAll('[aria-busy="true"]')].map((el) =>
        el.outerHTML.slice(0, 300),
      ),
    }));
    reports.push({
      actor,
      width,
      attempt,
      before,
      url: page.url(),
      initial,
      after,
      current,
      settled,
      errors,
      navigations,
    });
    writeFileSync(
      "harness/evidence/a11y-five-failures/dom-slow-frame.json",
      JSON.stringify(reports, null, 2),
    );
    console.log(
      JSON.stringify({
        actor,
        width,
        attempt,
        before,
        initialActive: initial.active,
        connected: after.connected,
        afterActive: after.activeHTML.slice(0, 180),
        settledActive: settled.active.slice(0, 200),
        errors,
      }),
    );
  }
  await context.close();
}
await browser.close();
