import type { CurriculumStage } from "./types";

export const CURRICULUM_STAGES: ReadonlyArray<CurriculumStage> = [
	{
		id: "stage-01",
		number: "01",
		title: "Minimalist Effect & Layer",
		shortTitle: "Effect & Layer",
		primitives: ["Effect", "Context.Service", "Layer", "pipe"],
		activeNodes: ["effect", "layer"],
		summary: "Every Effect program is an immutable blueprint Effect<A, E, R>—nothing executes until Layer dependencies are provided at the application edge.",
		mentalModel:
			"Think of Effect<A, E, R> as a typed recipe: R is the ingredients needed (Context.Service), E is the typed failure modes, and A is the success value. Layer.succeed and Layer.mergeAll satisfy R once at startup.",
		pipelineSpotlight: "Use Service.use(fn) with Effect.map and Effect.tap chained through .pipe(...) so dependencies flow implicitly without nesting callbacks.",
		bestPractice: "Keep Effect.runPromise strictly at the outermost boundary (main.ts or server bootstrap). Domain functions should return Effect values with explicit R requirements.",
		code: `import { Context, Effect, Layer } from "effect";

// 1. Define services using Effect v4 Context.Service
export class LedgerClock extends Context.Service<LedgerClock, { readonly nowIso: Effect.Effect<string> }>()("LedgerClock") {}

export class AuditLog extends Context.Service<AuditLog, { readonly record: (entry: string) => Effect.Effect<void> }>()("AuditLog") {}

// 2. Pure pipeline program
export function recordDispatch(recipient: string, message: string): Effect.Effect<{ id: string; entry: string }, never, LedgerClock | AuditLog> {
	return LedgerClock.use((clock) => clock.nowIso).pipe(
		Effect.map((timestamp) => ({ timestamp, entry: \`[\${timestamp}] -> \${recipient}: \${message}\` })),
		Effect.tap(({ entry }) => AuditLog.use((log) => log.record(entry))),
		Effect.map(({ timestamp, entry }) => ({
			id: \`disp-\${timestamp.slice(11, 19).replace(/:/g, "")}\`,
			recipient,
			entry,
		})),
	);
}

// 3. Provide implementations with Layer.succeed & Layer.mergeAll
const ClockLive = Layer.succeed(LedgerClock, {
	nowIso: Effect.sync(() => new Date().toISOString()),
});

const AuditLogLive = Layer.succeed(AuditLog, {
	record: (entry) => Effect.sync(() => console.log(entry)),
});

const AppLayer = Layer.mergeAll(ClockLive, AuditLogLive);

// 4. Wire dependencies at the edge with Effect.provide, then runPromise
const runnable = recordDispatch("ops@acme.dev", "Ledger booted cleanly").pipe(Effect.provide(AppLayer));

Effect.runPromise(runnable);`,
		fields: [
			{
				key: "recipient",
				label: "Recipient Email",
				type: "text",
				defaultValue: "ops@acme.dev",
			},
			{
				key: "message",
				label: "Dispatch Message",
				type: "text",
				defaultValue: "Ledger booted cleanly",
			},
		],
	},
	{
		id: "stage-02",
		number: "02",
		title: "Basics, Option & Typed Errors",
		shortTitle: "Option & Errors",
		primitives: ["Option", "Schema.TaggedError", "Effect.Do", "Effect.bind", "Effect.catchTag"],
		activeNodes: ["effect", "layer", "option"],
		summary: "Replace null checks and untyped try/catch blocks with Option and Schema.TaggedError, accumulating multi-step pipeline scope cleanly via Effect.Do and Effect.bind.",
		mentalModel: "Nullability belongs in Option<A>, while recoverable failures belong in the E channel. Effect.Do starts an empty record context; Effect.bind attaches named results without generator syntax.",
		pipelineSpotlight: "Effect.Do.pipe(Effect.bind('a', ...), Effect.bind('b', ({ a }) => ...)) is the direct pipeline equivalent of sequential bindings—zero yield*, 100% type-inferred.",
		bestPractice: "Recover selectively with Effect.catchTag('QuotaExceeded', handler) so unhandled errors (RecipientNotFound) remain visible in the function signature.",
		code: `import { Context, Effect, Option, Schema } from "effect";

// 1. Schema-backed typed domain errors (no throw, no untyped catch)
export class RecipientNotFound extends Schema.TaggedError<RecipientNotFound>()("RecipientNotFound", { recipientId: Schema.String }) {}

export class QuotaExceeded extends Schema.TaggedError<QuotaExceeded>()("QuotaExceeded", {
	recipientId: Schema.String,
	requested: Schema.Number,
	remaining: Schema.Number,
}) {}

export interface RecipientRecord {
	readonly id: string;
	readonly email: string;
	readonly remainingQuota: number;
}

export class RecipientRepo extends Context.Service<
	RecipientRepo,
	{
		readonly findById: (id: string) => Effect.Effect<Option.Option<RecipientRecord>>;
	}
>()("RecipientRepo") {}

// 2. Pure pipeline using Effect.Do + Effect.bind + Option + typed errors
export function prepareDispatch(recipientId: string, costUnits: number) {
	return Effect.Do.pipe(
		Effect.bind("maybeRecipient", () => RecipientRepo.use((repo) => repo.findById(recipientId))),
		Effect.bind("recipient", ({ maybeRecipient }) =>
			maybeRecipient.pipe(
				Option.match({
					onNone: () => Effect.fail(new RecipientNotFound({ recipientId })),
					onSome: Effect.succeed,
				}),
			),
		),
		Effect.flatMap(({ recipient }) =>
			recipient.remainingQuota < costUnits
				? Effect.fail(
						new QuotaExceeded({
							recipientId: recipient.id,
							requested: costUnits,
							remaining: recipient.remainingQuota,
						}),
					)
				: Effect.succeed({
						recipientId: recipient.id,
						email: recipient.email,
						reservedUnits: costUnits,
						remainingAfter: recipient.remainingQuota - costUnits,
					}),
		),
	);
}

// 3. Demonstrate typed error channel inspection + recovery via Effect.catchTag
const resilientDispatch = prepareDispatch("acct-low", 5).pipe(
	Effect.catchTag("QuotaExceeded", (err) =>
		Effect.succeed({
			recipientId: err.recipientId,
			email: "fallback@acme.dev",
			reservedUnits: 1,
			remainingAfter: Math.max(0, err.remaining - 1),
			recoveredFrom: "QuotaExceeded",
		}),
	),
);`,
		fields: [
			{
				key: "recipientId",
				label: "Account ID",
				type: "select",
				defaultValue: "acct-acme",
				options: [
					{ label: "acct-acme (quota: 10)", value: "acct-acme" },
					{ label: "acct-low (quota: 2 — triggers QuotaExceeded)", value: "acct-low" },
					{ label: "acct-missing (None — triggers RecipientNotFound)", value: "acct-missing" },
				],
			},
			{
				key: "costUnits",
				label: "Requested Units",
				type: "number",
				defaultValue: 3,
				hint: "Try 5 on acct-low to see catchTag recovery",
			},
		],
	},
	{
		id: "stage-03",
		number: "03",
		title: "Config & Schema Validation",
		shortTitle: "Config & Schema",
		primitives: ["Config", "ConfigProvider", "Redacted", "Schema.Struct", "Schema.decodeUnknownEffect"],
		activeNodes: ["effect", "layer", "config", "schema"],
		summary: "Load environment settings declaratively with Config + Redacted inside Layer.effect, and parse untrusted external payloads through Effect Schema.",
		mentalModel:
			"Config is itself an Effect<T, ConfigError>. Wrapping secrets in Config.Redacted prevents accidental token leaks in logs, while Schema.decodeUnknownEffect turns unknown JSON into typed domain values in the E channel.",
		pipelineSpotlight: "Pass Config.all({ ... }) directly into Layer.effect(SettingsService, ...)—in Effect v4, Config values are natively Effects!",
		bestPractice: "Always inject ConfigProvider via ConfigProvider.layer(...) in tests instead of mutating process.env globally.",
		code: `import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";

// 1. Declarative Schema for boundary validation
export const DispatchPayloadSchema = Schema.Struct({
	recipientEmail: Schema.NonEmptyString.pipe(Schema.check(Schema.isPattern(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/))),
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
}`,
		fields: [
			{
				key: "envRegion",
				label: "DISPATCH_REGION",
				type: "text",
				defaultValue: "us-east-1",
			},
			{
				key: "maxRetries",
				label: "DISPATCH_MAX_RETRIES",
				type: "number",
				defaultValue: 3,
			},
			{
				key: "recipientEmail",
				label: "Payload Email",
				type: "text",
				defaultValue: "alerts@acme.dev",
				hint: "Enter an invalid email to test Schema rejection",
			},
			{
				key: "priority",
				label: "Priority (1-5)",
				type: "number",
				defaultValue: 2,
			},
		],
	},
	{
		id: "stage-04",
		number: "04",
		title: "Pattern Matching & Tagged Unions",
		shortTitle: "Pattern Match",
		primitives: ["Schema.TaggedClass", "Schema.Union", "Match.type", "Match.tagsExhaustive", "Match.value"],
		activeNodes: ["effect", "schema", "match"],
		summary: "Model domain commands as Schema.TaggedClass discriminated unions and route every variant with compiler-enforced Match.tagsExhaustive.",
		mentalModel: "Switch statements silently rot when new union members are added. Match.type<Union>().pipe(Match.tagsExhaustive({ ... })) fails at compile time if any _tag is missing.",
		pipelineSpotlight: "Combine Schema.decodeUnknownEffect(Union)(raw) -> Effect.map(computeRoutingPlan) so runtime validation feeds directly into exhaustive pattern matching.",
		bestPractice: "Use Schema.TaggedClass when you want both runtime JSON codecs and ergonomic class constructors with automatic _tag literals.",
		code: `import { Match, Schema } from "effect";

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
			note: \`Email queued with subject "\${cmd.subject}"\`,
		}),
		SendSms: (cmd) => ({
			transport: "twilio-gateway",
			target: cmd.phone,
			slaMs: 400,
			note: \`SMS length \${cmd.body.length} chars\`,
		}),
		WebhookPush: (cmd) => ({
			transport: "http-post-signed",
			target: cmd.endpoint,
			slaMs: 1000,
			note: \`Webhook configured for \${cmd.retries} retries\`,
		}),
	}),
);

// 3. Value-level Match with predicate guards
export function classifyLatencyTier(slaMs: number) {
	return Match.value(slaMs).pipe(
		Match.when(
			(ms) => ms <= 400,
			() => "realtime",
		),
		Match.when(
			(ms) => ms <= 1200,
			() => "standard",
		),
		Match.orElse(() => "batch"),
	);
}`,
		fields: [
			{
				key: "commandType",
				label: "Command Variant",
				type: "select",
				defaultValue: "SendEmail",
				options: [
					{ label: "SendEmail", value: "SendEmail" },
					{ label: "SendSms", value: "SendSms" },
					{ label: "WebhookPush", value: "WebhookPush" },
				],
			},
			{
				key: "target",
				label: "Target (Email / Phone / URL)",
				type: "text",
				defaultValue: "ops@acme.dev",
			},
			{
				key: "urgency",
				label: "Urgency / Retries",
				type: "number",
				defaultValue: 5,
			},
		],
	},
	{
		id: "stage-05",
		number: "05",
		title: "Stream & Backpressured Concurrency",
		shortTitle: "Stream",
		primitives: ["Stream.fromIterable", "Stream.mapEffect", "Stream.filter", "Stream.runCollect"],
		activeNodes: ["effect", "schema", "match", "stream"],
		summary: "Process unbounded or batched dispatch events with lazy, pull-based Stream pipelines that bound concurrency and propagate errors automatically.",
		mentalModel: "A Stream<A, E, R> is to multiple values what Effect<A, E, R> is to one value. Downstream consumers pull at their own pace, giving automatic backpressure.",
		pipelineSpotlight: "Stream.mapEffect(fn, { concurrency }) runs up to N fibers in parallel while preserving backpressure and clean resource finalization.",
		bestPractice: "Always set explicit { concurrency } bounds on external I/O stages inside Stream.mapEffect instead of spawning unbounded Promise.all batches.",
		code: `import { Effect, Match, Schema, Stream } from "effect";
import { DispatchCommandSchema, computeRoutingPlan } from "./stage04PatternMatch";

// Pure pipeline Stream: decode -> filter -> concurrent mapEffect -> runCollect
export function processDispatchBatch(rawBatch: ReadonlyArray<unknown>, concurrency: number, minUrgency: number) {
	return Stream.fromIterable(rawBatch).pipe(
		Stream.mapEffect((raw) => Schema.decodeUnknownEffect(DispatchCommandSchema)(raw), {
			concurrency,
		}),
		Stream.filter((cmd) =>
			Match.value(cmd).pipe(
				Match.tag("SendEmail", (email) => email.urgency >= minUrgency),
				Match.orElse(() => true),
			),
		),
		Stream.mapEffect((cmd) => Effect.sleep("15 millis").pipe(Effect.map(() => ({ tag: cmd._tag, ...computeRoutingPlan(cmd) }))), { concurrency }),
		Stream.runCollect,
	);
}`,
		fields: [
			{
				key: "concurrency",
				label: "Stream Concurrency",
				type: "number",
				defaultValue: 2,
				hint: "1 to 5 concurrent fibers",
			},
			{
				key: "minUrgency",
				label: "Email Min Urgency Filter",
				type: "number",
				defaultValue: 2,
				hint: "Filters out low-urgency SendEmail items",
			},
		],
	},
	{
		id: "stage-06",
		number: "06",
		title: "HttpApi & HttpServer Semantics",
		shortTitle: "HttpApi & Server",
		primitives: ["HttpApi", "HttpApiGroup", "HttpApiEndpoint", "HttpApiBuilder", "HttpRouter.toWebHandler"],
		activeNodes: ["effect", "layer", "schema", "httpapi"],
		summary: "Define contract-first HTTP endpoints with typed params, payloads, and error status codes using HttpApi, then bind handlers with HttpApiBuilder.",
		mentalModel:
			"HttpApi separates the API specification (schemas, routes, HTTP statuses, OpenAPI metadata) from server implementation (HttpApiBuilder.group) and transport (NodeHttpServer.layer or HttpRouter.toWebHandler).",
		pipelineSpotlight: "Resolve long-lived store services once at Layer build time inside HttpApiBuilder.group using DispatchStore.pipe(Effect.map((store) => handlers.handle(...))).",
		bestPractice: "Annotate domain error schemas with HttpApiSchema.status(404) so returning Effect.fail(new DispatchNotFound(...)) automatically serializes a clean 404 JSON response.",
		code: `import { Context, Effect, Layer, Ref, Schema } from "effect";
import { HttpServer } from "effect/http";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

// 1. Schemas for HttpApi contract
export const DispatchItemSchema = Schema.Struct({
	id: Schema.String,
	recipient: Schema.String,
	subject: Schema.String,
	status: Schema.Literals(["queued", "delivered"]),
});

export class DispatchNotFound extends Schema.TaggedError<DispatchNotFound>()("DispatchNotFound", {
	id: Schema.String,
}) {}

export const CreateDispatchPayload = Schema.Struct({
	recipient: Schema.NonEmptyString,
	subject: Schema.NonEmptyString,
});

// 2. Declarative HttpApi definition (contract-first, zero Express boilerplate)
export const DispatchGroup = HttpApiGroup.make("dispatches")
	.add(
		HttpApiEndpoint.post("create", "/dispatches", {
			payload: CreateDispatchPayload,
			success: DispatchItemSchema.pipe(HttpApiSchema.status(201)),
		}),
	)
	.add(
		HttpApiEndpoint.get("getById", "/dispatches/:id", {
			params: { id: Schema.NonEmptyString },
			success: DispatchItemSchema,
			error: DispatchNotFound.pipe(HttpApiSchema.status(404)),
		}),
	);

export const LedgerApi = HttpApi.make("LedgerApi").add(DispatchGroup);

// 3. Domain store service required by the endpoint handlers
export class DispatchStore extends Context.Service<
	DispatchStore,
	{
		readonly create: (recipient: string, subject: string) => Effect.Effect<typeof DispatchItemSchema.Type>;
		readonly findById: (id: string) => Effect.Effect<typeof DispatchItemSchema.Type, DispatchNotFound>;
		readonly snapshot: Effect.Effect<ReadonlyArray<typeof DispatchItemSchema.Type>>;
	}
>()("DispatchStore") {}

export const DispatchStoreLive = Layer.effect(
	DispatchStore,
	Ref.make<Map<string, typeof DispatchItemSchema.Type>>(
		new Map([
			[
				"disp-101",
				{
					id: "disp-101",
					recipient: "ops@acme.dev",
					subject: "Initial Ledger Seed",
					status: "delivered",
				},
			],
		]),
	).pipe(
		Effect.map((storeRef) => {
			const snapshot = Ref.get(storeRef).pipe(Effect.map((map) => Array.from(map.values())));
			return {
				create: (recipient, subject) =>
					Ref.modify(storeRef, (map) => {
						const id = \`disp-\${101 + map.size}\`;
						const item: typeof DispatchItemSchema.Type = {
							id,
							recipient,
							subject,
							status: "queued",
						};
						const next = new Map(map);
						next.set(id, item);
						return [item, next] as const;
					}).pipe(),
				findById: (id) =>
					Ref.get(storeRef).pipe(
						Effect.flatMap((map) => {
							const found = map.get(id);
							return found ? Effect.succeed(found) : Effect.fail(new DispatchNotFound({ id }));
						}),
					),
				snapshot,
			};
		}),
	),
);

// 4. Implement HttpApiGroup handlers via pure pipelines
export const DispatchGroupLive = HttpApiBuilder.group(LedgerApi, "dispatches", (handlers) =>
	DispatchStore.pipe(Effect.map((store) => handlers.handle("create", ({ payload }) => store.create(payload.recipient, payload.subject)).handle("getById", ({ params }) => store.findById(params.id)))),
);

// 5. Build Web-standard Request -> Response handler with HttpRouter.toWebHandler
export const ApiLayer = HttpApiBuilder.layer(LedgerApi).pipe(Layer.provide(DispatchGroupLive), Layer.provide(DispatchStoreLive), Layer.provide(HttpServer.layerServices));`,
		fields: [
			{
				key: "method",
				label: "HTTP Method",
				type: "select",
				defaultValue: "POST",
				options: [
					{ label: "POST /dispatches", value: "POST" },
					{ label: "GET /dispatches/:id", value: "GET" },
				],
			},
			{
				key: "path",
				label: "GET Path (for GET)",
				type: "text",
				defaultValue: "/dispatches/disp-101",
				hint: "Try /dispatches/missing to observe typed 404",
			},
			{
				key: "recipient",
				label: "POST Recipient",
				type: "text",
				defaultValue: "cto@acme.dev",
			},
			{
				key: "subject",
				label: "POST Subject",
				type: "text",
				defaultValue: "Quarterly Audit Ready",
			},
		],
	},
	{
		id: "stage-07",
		number: "07",
		title: "PersistedQueue & Durable Retries",
		shortTitle: "PersistedQueue",
		primitives: ["PersistedQueue.make", "queue.offer", "queue.take", "Schedule.spaced", "layerStoreMemory"],
		activeNodes: ["effect", "layer", "schema", "httpapi", "queue"],
		summary: "Decouple HTTP ingestion from unreliable downstream delivery using PersistedQueue for idempotent deduplication, scoped acknowledgements, and Schedule-driven retries.",
		mentalModel:
			"PersistedQueue.take opens a Scope around each item. If the handler Effect succeeds, the store marks the item complete; if it fails, the store increments attempts and re-queues it after retrySchedule.",
		pipelineSpotlight: "Pass { id: idempotencyKey, deduplicate: 'untilRemoved' } to queue.offer so duplicate webhooks or retries never enqueue duplicate work.",
		bestPractice: "Develop with PersistedQueue.layerStoreMemory and swap to PersistedQueue.layerStoreSql or layerStoreRedis at the edge—handler code stays identical.",
		code: `import { Effect, Layer, Schedule, Schema } from "effect";
import { PersistedQueue } from "effect/persistence";

export const QueuedDispatchSchema = Schema.Struct({
	recipient: Schema.NonEmptyString,
	subject: Schema.NonEmptyString,
});

export class TransientSmtpError extends Schema.TaggedError<TransientSmtpError>()("TransientSmtpError", { attempt: Schema.Number, reason: Schema.String }) {}

// Pure pipeline building PersistedQueue, offering with idempotency key, and taking with scoped retry
export function durableDispatchFlow(idempotencyKey: string, recipient: string) {
	return Effect.Do.pipe(
		Effect.bind("queue", () =>
			PersistedQueue.make({
				name: "dispatches-durable",
				schema: QueuedDispatchSchema,
				maxAttempts: 3,
				retrySchedule: Schedule.spaced("20 millis"),
			}),
		),
		Effect.bind("firstOfferId", ({ queue }) => queue.offer({ recipient, subject: "Invoice #9042 Ready" }, { id: idempotencyKey, deduplicate: "untilRemoved" })),
		// Duplicate offer with the same idempotencyKey is safely ignored
		Effect.bind("dupId", ({ queue }) => queue.offer({ recipient, subject: "Invoice #9042 Duplicate" }, { id: idempotencyKey, deduplicate: "untilRemoved" })),
		Effect.bind("outcome", ({ queue }) =>
			queue.take((item, metadata) =>
				metadata.attempts === 1
					? Effect.fail(new TransientSmtpError({ attempt: metadata.attempts, reason: "Upstream SMTP 421 busy" }))
					: Effect.succeed({ deliveredId: metadata.id, attemptsUsed: metadata.attempts, recipient: item.recipient, subject: item.subject }),
			),
		),
		Effect.provide(PersistedQueue.layer.pipe(Layer.provide(PersistedQueue.layerStoreMemory))),
	);
}`,
		fields: [
			{
				key: "idempotencyKey",
				label: "Idempotency Key",
				type: "text",
				defaultValue: "order-9042",
			},
			{
				key: "recipient",
				label: "Recipient",
				type: "text",
				defaultValue: "finance@acme.dev",
			},
			{
				key: "failFirstAttempt",
				label: "Simulate Attempt 1 Transient Failure",
				type: "boolean",
				defaultValue: true,
			},
			{
				key: "sendDuplicateOffer",
				label: "Send Duplicate Offer With Same Key",
				type: "boolean",
				defaultValue: true,
			},
		],
	},
	{
		id: "stage-08",
		number: "08",
		title: "Cluster & Actor Model Semantics",
		shortTitle: "Cluster Actors",
		primitives: ["Entity.make", "Rpc.make", "Entity.toLayer", "Entity.CurrentAddress", "TestRunner.layer"],
		activeNodes: ["effect", "layer", "schema", "httpapi", "queue", "cluster"],
		summary: "Model stateful per-tenant dispatchers as location-transparent Virtual Actors with serialized mailboxes, shard routing, and automatic idle passivation.",
		mentalModel:
			"Each EntityId gets its own long-lived actor instance pinned to a ShardId. Setting concurrency: 1 serializes the entity's mailbox so per-tenant state (Ref) never suffers race conditions, even across concurrent callers.",
		pipelineSpotlight:
			"Call Entity.client to obtain (entityId) => rpcClient, then compose concurrent tenant calls with Effect.all(..., { concurrency: 'unbounded' })—the cluster routes and serializes per entity automatically.",
		bestPractice: "Use TestRunner.layer in unit tests, SingleRunner.layer + SqlClient for single-node durability, and NodeClusterHttp / NodeClusterSocket when scaling horizontally across pods.",
		code: `import { Effect, Ref, Schema } from "effect";
import { Entity } from "effect/cluster";
import { Rpc } from "effect/rpc";

// 1. Define Actor RPC protocol
export class DailyLimitReached extends Schema.TaggedError<DailyLimitReached>()("DailyLimitReached", { tenantId: Schema.String, sentCount: Schema.Number }) {}

export const DispatchRpc = Rpc.make("Dispatch", {
	payload: { subject: Schema.NonEmptyString },
	success: Schema.Struct({
		entityAddress: Schema.String,
		shardId: Schema.String,
		sequenceNo: Schema.Number,
		subject: Schema.String,
	}),
	error: DailyLimitReached,
});

export const GetLedgerRpc = Rpc.make("GetLedger", {
	success: Schema.Struct({
		entityId: Schema.String,
		totalSent: Schema.Number,
		subjects: Schema.Array(Schema.String),
	}),
});

// 2. Define Cluster Entity (Virtual Actor)
export const TenantDispatcher = Entity.make("TenantDispatcher", [DispatchRpc, GetLedgerRpc]);

// 3. Implement Entity behavior as a Layer with isolated per-entity Ref state
interface TenantState {
	readonly totalSent: number;
	readonly subjects: ReadonlyArray<string>;
}

export const TenantDispatcherLive = TenantDispatcher.toLayer(
	Effect.Do.pipe(
		Effect.bind("address", () => Entity.CurrentAddress),
		Effect.bind("stateRef", () =>
			Ref.make<TenantState>({
				totalSent: 0,
				subjects: [],
			}),
		),
		Effect.map(({ address, stateRef }) =>
			TenantDispatcher.of({
				Dispatch: (envelope) =>
					Ref.modify(
						stateRef,
						(
							state,
						): readonly [
							Effect.Effect<
								{
									readonly entityAddress: string;
									readonly shardId: string;
									readonly sequenceNo: number;
									readonly subject: string;
								},
								DailyLimitReached
							>,
							TenantState,
						] => {
							if (state.totalSent >= 3) {
								return [
									Effect.fail(
										new DailyLimitReached({
											tenantId: address.entityId,
											sentCount: state.totalSent,
										}),
									),
									state,
								];
							}
							const nextSeq = state.totalSent + 1;
							const nextState: TenantState = {
								totalSent: nextSeq,
								subjects: [...state.subjects, envelope.payload.subject],
							};
							return [
								Effect.succeed({
									entityAddress: \`\${address.entityType}/\${address.entityId}\`,
									shardId: String(address.shardId),
									sequenceNo: nextSeq,
									subject: envelope.payload.subject,
								}),
								nextState,
							];
						},
					).pipe(Effect.flatten),
				GetLedger: () =>
					Ref.get(stateRef).pipe(
						Effect.map((state) => ({
							entityId: address.entityId,
							totalSent: state.totalSent,
							subjects: [...state.subjects],
						})),
					),
			}),
		),
	),
	{ maxIdleTime: "5 minutes", concurrency: 1 },
);`,
		fields: [
			{
				key: "tenantA",
				label: "Primary Tenant EntityId",
				type: "text",
				defaultValue: "tenant-acme",
			},
			{
				key: "tenantB",
				label: "Secondary Tenant EntityId",
				type: "text",
				defaultValue: "tenant-globex",
			},
			{
				key: "messagesPerTenant",
				label: "Concurrent Burst to Tenant A (cap=3)",
				type: "number",
				defaultValue: 2,
				hint: "Set to 4 to observe DailyLimitReached protection",
			},
		],
	},
];

export interface PipelineRulePair {
	readonly id: string;
	readonly topic: string;
	readonly avoid: string;
	readonly prefer: string;
	readonly explanation: string;
}

export const PIPELINE_RULES: ReadonlyArray<PipelineRulePair> = [
	{
		id: "sequential-bindings",
		topic: "Chaining Multiple Dependent Values",
		avoid: `Effect.gen(function*() {
  const user = yield* findUser(id)
  const quota = yield* loadQuota(user.orgId)
  return { user, quota }
})`,
		prefer: `Effect.Do.pipe(
  Effect.bind("user", () => findUser(id)),
  Effect.bind("quota", ({ user }) => loadQuota(user.orgId))
)`,
		explanation: "Effect.Do creates an empty scope object and Effect.bind accumulates named values with full TypeScript inference—no generator state machine needed.",
	},
	{
		id: "side-effects",
		topic: "Observing Values Without Altering Output",
		avoid: `Effect.gen(function*() {
  const item = yield* createItem(payload)
  yield* AuditLog.use((log) => log.record(item.id))
  return item
})`,
		prefer: `createItem(payload).pipe(
  Effect.tap((item) => AuditLog.use((log) => log.record(item.id)))
)`,
		explanation: "Effect.tap runs an Effect for its side effect or requirement and passes the original value unchanged down the pipeline.",
	},
	{
		id: "branching-recovery",
		topic: "Typed Error Recovery & Option Matching",
		avoid: `try {
  const res = yield* charge(acct)
} catch (err) {
  // untyped catch
}`,
		prefer: `charge(acct).pipe(
  Effect.catchTag("QuotaExceeded", (err) =>
    Effect.succeed({ recovered: true, remaining: err.remaining })
  )
)`,
		explanation: "Effect.catchTag narrows both the error parameter and removes the handled tag from the Effect's E type channel at compile time.",
	},
	{
		id: "service-access",
		topic: "Accessing Services Inside Pipelines",
		avoid: `Effect.gen(function*() {
  const clock = yield* LedgerClock
  return yield* clock.nowIso
})`,
		prefer: `LedgerClock.use((clock) => clock.nowIso).pipe(
  Effect.map((iso) => ({ createdAt: iso }))
)`,
		explanation: "In Effect v4, Context.Service provides .use(fn) and .useSync(fn) so accessing a service method is a single concise pipeline step.",
	},
];
