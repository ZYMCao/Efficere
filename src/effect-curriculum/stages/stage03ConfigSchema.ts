import { Config, ConfigProvider, Context, Effect, Exit, Layer, Redacted, Schema } from "effect";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage03Input {
	readonly envRegion?: string;
	readonly maxRetries?: number;
	readonly apiToken?: string;
	readonly recipientEmail?: string;
	readonly priority?: number;
}

// 1. Declarative Schema for boundary validation
export const DispatchPayloadSchema = Schema.Struct({
	recipientEmail: Schema.NonEmptyString.pipe(Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))),
	priority: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 5 }))),
	channel: Schema.Literals(["email", "sms", "webhook"]),
});

export type DispatchPayload = typeof DispatchPayloadSchema.Type;

export interface AppSettings {
	readonly region: string;
	readonly maxRetries: number;
	readonly apiToken: Redacted.Redacted<string>;
}

export class SettingsService extends Context.Service<SettingsService, AppSettings>()("SettingsService") {}

// 2. Load configuration into a Layer using Config.* combinators
export const SettingsLayer = Layer.effect(
	SettingsService,
	Config.all({
		region: Config.String("DISPATCH_REGION").pipe(Config.withDefault("us-east-1")),
		maxRetries: Config.Int("DISPATCH_MAX_RETRIES").pipe(Config.withDefault(3)),
		apiToken: Config.Redacted("DISPATCH_API_TOKEN"),
	}),
);

export function validateAndAttachConfig(rawPayload: unknown) {
	return Effect.Do.pipe(
		Effect.bind("settings", () => SettingsService),
		Effect.bind("payload", () => Schema.decodeUnknownEffect(DispatchPayloadSchema)(rawPayload)),
		Effect.map(({ settings, payload }) => ({
			accepted: true,
			region: settings.region,
			maxRetries: settings.maxRetries,
			tokenRedactedPreview: String(settings.apiToken),
			tokenLength: Redacted.value(settings.apiToken).length,
			payload,
		})),
	);
}

export function runStage03(input: Stage03Input): Promise<StageExecutionResult> {
	const startedAt = performance.now();
	const trace: Array<TraceEvent> = [];

	function pushTrace(module: string, label: string, detail: string, status: TraceEvent["status"] = "ok") {
		trace.push({
			step: trace.length + 1,
			module,
			label,
			detail,
			elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
			status,
		});
	}

	const envRecord: Record<string, string> = {
		DISPATCH_REGION: (input.envRegion ?? "us-east-1").trim() || "us-east-1",
		DISPATCH_MAX_RETRIES: String(input.maxRetries ?? 3),
		DISPATCH_API_TOKEN: (input.apiToken ?? "sk-live-secret-9981").trim(),
	};

	const customProvider = ConfigProvider.fromEnv({ env: envRecord });
	pushTrace("ConfigProvider", "ConfigProvider.fromEnv", `Loaded env keys: ${Object.keys(envRecord).join(", ")}`);

	const rawPayload = {
		recipientEmail: input.recipientEmail ?? "alerts@acme.dev",
		priority: Number(input.priority ?? 2),
		channel: "email",
	};

	const runnable = validateAndAttachConfig(rawPayload).pipe(
		Effect.tap((res) =>
			Effect.sync(() => {
				pushTrace("Config.Redacted", "String(settings.apiToken)", `Safely logged as ${res.tokenRedactedPreview} (actual len=${res.tokenLength})`);
				pushTrace("Schema", "Schema.decodeUnknownEffect", `Validated ${res.payload.recipientEmail} at priority ${res.payload.priority}`);
			}),
		),
		Effect.provide(SettingsLayer),
		Effect.provide(ConfigProvider.layer(customProvider)),
	);

	return Effect.runPromiseExit(runnable).then((exit) => {
		if (Exit.isSuccess(exit)) {
			return {
				stageId: "stage-03",
				ok: true,
				statusLabel: "COMPLETED",
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				output: exit.value,
				trace,
				stateSnapshot: {
					envProvided: {
						DISPATCH_REGION: envRecord.DISPATCH_REGION,
						DISPATCH_MAX_RETRIES: envRecord.DISPATCH_MAX_RETRIES,
						DISPATCH_API_TOKEN: "<redacted>",
					},
				},
			};
		}

		pushTrace("Schema", "Validation / Config Failure", String(exit.cause), "error");

		return {
			stageId: "stage-03",
			ok: false,
			statusLabel: "VALIDATION_FAILED",
			durationMs: Number((performance.now() - startedAt).toFixed(2)),
			output: { error: String(exit.cause), rawPayload },
			errorTag: "SchemaOrConfigError",
			trace,
		};
	});
}
