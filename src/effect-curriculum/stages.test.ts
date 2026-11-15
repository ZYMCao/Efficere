import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runStageById } from "./runner";

const stageFiles = [
  "stage01Minimal.ts",
  "stage02BasicsOption.ts",
  "stage03ConfigSchema.ts",
  "stage04PatternMatch.ts",
  "stage05Stream.ts",
  "stage06HttpApi.ts",
  "stage07PersistedQueue.ts",
  "stage08Cluster.ts",
];

test("Strict Pipeline Rule: zero Effect.gen, function*, or yield* across all stages", () => {
  for (const file of stageFiles) {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/effect-curriculum/stages", file),
      "utf8"
    );
    assert.equal(
      content.includes("Effect.gen"),
      false,
      `${file} must not use Effect.gen`
    );
    assert.equal(
      content.includes("yield*"),
      false,
      `${file} must not use yield*`
    );
    assert.equal(
      /function\s*\*/.test(content),
      false,
      `${file} must not contain generator functions`
    );
  }
});

test("Stage 01: Minimalist Effect + Context.Service + Layer runs cleanly", async () => {
  const res = await runStageById("stage-01", {
    recipient: "sre@acme.dev",
    message: "Pipeline booted",
  });
  assert.equal(res.ok, true);
  assert.equal(res.statusLabel, "COMPLETED");
  assert.ok(res.trace.length >= 3);
});

test("Stage 02: Option + catchTag recovers QuotaExceeded and fails cleanly on missing recipient", async () => {
  const recovered = await runStageById("stage-02", {
    recipientId: "acct-low",
    costUnits: 5,
  });
  assert.equal(recovered.ok, true);
  assert.equal((recovered.output as { recoveredFrom?: string }).recoveredFrom, "QuotaExceeded");

  const missing = await runStageById("stage-02", {
    recipientId: "acct-missing",
    costUnits: 1,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.statusLabel, "TYPED_ERROR");
  assert.equal(missing.errorTag, "RecipientNotFound");
});

test("Stage 03: Config + Redacted + Schema validates valid input and rejects invalid email", async () => {
  const valid = await runStageById("stage-03", {
    envRegion: "eu-west-1",
    maxRetries: 4,
    apiToken: "sk-super-secret",
    recipientEmail: "ops@acme.dev",
    priority: 3,
  });
  assert.equal(valid.ok, true);
  assert.equal(
    (valid.output as { tokenRedactedPreview: string }).tokenRedactedPreview,
    "<redacted>"
  );

  const invalid = await runStageById("stage-03", {
    recipientEmail: "not-an-email",
    priority: 99,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.statusLabel, "VALIDATION_FAILED");
});

test("Stage 04: Exhaustive Match routes SendEmail, SendSms, and WebhookPush", async () => {
  const sms = await runStageById("stage-04", {
    commandType: "SendSms",
    target: "+14155550100",
    urgency: 3,
  });
  assert.equal(sms.ok, true);
  assert.equal((sms.output as { plan: { transport: string } }).plan.transport, "twilio-gateway");
});

test("Stage 05: Stream processes and filters batch concurrently", async () => {
  const res = await runStageById("stage-05", { concurrency: 3, minUrgency: 3 });
  assert.equal(res.ok, true);
  const out = res.output as { emittedCount: number; ingestedCount: number };
  assert.equal(out.ingestedCount, 5);
  assert.equal(out.emittedCount, 4);
});

test("Stage 06: HttpApi + HttpRouter.toWebHandler handles POST 201 and GET 200 / 404", async () => {
  const created = await runStageById("stage-06", {
    method: "POST",
    recipient: "lead@acme.dev",
    subject: "HttpApi Live",
  });
  assert.equal(created.ok, true);
  assert.equal((created.output as { httpStatus: number }).httpStatus, 201);

  const notFound = await runStageById("stage-06", {
    method: "GET",
    path: "/dispatches/missing-999",
  });
  assert.equal(notFound.ok, false);
  assert.equal((notFound.output as { httpStatus: number }).httpStatus, 404);
});

test("Stage 07: PersistedQueue deduplicates offers and retries failed attempt 1 to succeed on attempt 2", async () => {
  const res = await runStageById("stage-07", {
    idempotencyKey: "job-777",
    failFirstAttempt: true,
    sendDuplicateOffer: true,
  });
  assert.equal(res.ok, true);
  const out = res.output as {
    deduplicated: boolean;
    workerOutcome: { attemptsUsed: number };
  };
  assert.equal(out.deduplicated, true);
  assert.equal(out.workerOutcome.attemptsUsed, 2);
});

test("Stage 08: Cluster Entity isolates actor state per tenantId and enforces cap", async () => {
  const res = await runStageById("stage-08", {
    tenantA: "tenant-acme",
    tenantB: "tenant-globex",
    messagesPerTenant: 4,
  });
  assert.equal(res.ok, true);
  const out = res.output as {
    acmeLedger: { totalSent: number };
    globexLedger: { totalSent: number };
  };
  assert.equal(out.acmeLedger.totalSent, 3);
  assert.equal(out.globexLedger.totalSent, 1);
});
