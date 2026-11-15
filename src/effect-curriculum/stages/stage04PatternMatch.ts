import { Effect, Exit, Match, Schema, pipe } from "effect";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage04Input {
  readonly commandType?: string;
  readonly target?: string;
  readonly urgency?: number;
}

// 1. Discriminated Union built with Schema.TaggedClass
export class SendEmail extends Schema.TaggedClass<SendEmail>()("SendEmail", {
  to: Schema.NonEmptyString,
  subject: Schema.NonEmptyString,
  urgency: Schema.Int,
}) {}

export class SendSms extends Schema.TaggedClass<SendSms>()("SendSms", {
  phone: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
}) {}

export class WebhookPush extends Schema.TaggedClass<WebhookPush>()("WebhookPush", {
  endpoint: Schema.NonEmptyString,
  retries: Schema.Int,
}) {}

export const DispatchCommandSchema = Schema.Union([SendEmail, SendSms, WebhookPush]);
export type DispatchCommand = typeof DispatchCommandSchema.Type;

// 2. Exhaustive pattern matching with Match.type + Match.tagsExhaustive
export const computeRoutingPlan = Match.type<DispatchCommand>().pipe(
  Match.tagsExhaustive({
    SendEmail: (cmd) => ({
      transport: "smtp-pool",
      target: cmd.to,
      slaMs: cmd.urgency >= 4 ? 250 : 2000,
      note: `Email queued with subject "${cmd.subject}"`,
    }),
    SendSms: (cmd) => ({
      transport: "twilio-gateway",
      target: cmd.phone,
      slaMs: 400,
      note: `SMS length ${cmd.body.length} chars`,
    }),
    WebhookPush: (cmd) => ({
      transport: "http-post-signed",
      target: cmd.endpoint,
      slaMs: 1000,
      note: `Webhook configured for ${cmd.retries} retries`,
    }),
  })
);

// 3. Value-level Match with predicate guards
export const classifyLatencyTier = (slaMs: number) =>
  Match.value(slaMs).pipe(
    Match.when((ms) => ms <= 400, () => "realtime"),
    Match.when((ms) => ms <= 1200, () => "standard"),
    Match.orElse(() => "batch")
  );

export const runStage04 = (input: Stage04Input): Promise<StageExecutionResult> => {
  const startedAt = performance.now();
  const trace: Array<TraceEvent> = [];
  const kind = input.commandType ?? "SendEmail";
  const target = (input.target ?? "ops@acme.dev").trim() || "ops@acme.dev";
  const urgency = Number(input.urgency ?? 5);

  const pushTrace = (
    module: string,
    label: string,
    detail: string,
    status: TraceEvent["status"] = "ok"
  ) => {
    trace.push({
      step: trace.length + 1,
      module,
      label,
      detail,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      status,
    });
  };

  const rawCommand =
    kind === "SendSms"
      ? { _tag: "SendSms", phone: target, body: "Ledger alert: threshold crossed" }
      : kind === "WebhookPush"
        ? { _tag: "WebhookPush", endpoint: target, retries: urgency }
        : { _tag: "SendEmail", to: target, subject: "Critical Settlement", urgency };

  const program = pipe(
    Schema.decodeUnknownEffect(DispatchCommandSchema)(rawCommand),
    Effect.tap((cmd) =>
      Effect.sync(() =>
        pushTrace("Schema", "Decoded TaggedClass", `Matched union variant ${cmd._tag}`)
      )
    ),
    Effect.map((cmd) => {
      const plan = computeRoutingPlan(cmd);
      const tier = classifyLatencyTier(plan.slaMs);
      pushTrace(
        "Match",
        "Match.tagsExhaustive",
        `Routed ${cmd._tag} -> ${plan.transport} (${tier} tier, ${plan.slaMs}ms SLA)`
      );
      return { variant: cmd._tag, tier, plan };
    })
  );

  return Effect.runPromiseExit(program).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return {
        stageId: "stage-04",
        ok: true,
        statusLabel: "COMPLETED",
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        output: exit.value,
        trace,
      };
    }

    return {
      stageId: "stage-04",
      ok: false,
      statusLabel: "VALIDATION_FAILED",
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      output: { error: String(exit.cause) },
      errorTag: "SchemaError",
      trace,
    };
  });
};
