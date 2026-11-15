import { Config, Effect, Layer, Schema, pipe } from "effect";
import { HttpRouter, HttpStaticServer } from "effect/http";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { runStageById } from "./effect-curriculum/runner";
import type { StageExecutionResult } from "./effect-curriculum/types";

export const StageIdSchema = Schema.Literals(["stage-01", "stage-02", "stage-03", "stage-04", "stage-05", "stage-06", "stage-07", "stage-08"]);

export class UnknownStageError extends Schema.TaggedError<UnknownStageError>()("UnknownStageError", { stageId: Schema.String }) {}

export const TraceEventSchema = Schema.Struct({
	step: Schema.Number,
	module: Schema.String,
	label: Schema.String,
	detail: Schema.String,
	elapsedMs: Schema.Number,
	status: Schema.Literals(["ok", "warn", "error"]),
});

export const StageExecutionResultSchema = Schema.Struct({
	stageId: StageIdSchema,
	ok: Schema.Boolean,
	statusLabel: Schema.Literals(["COMPLETED", "TYPED_ERROR", "VALIDATION_FAILED"]),
	durationMs: Schema.Number,
	output: Schema.Unknown,
	errorTag: Schema.optional(Schema.String),
	trace: Schema.Array(TraceEventSchema),
	stateSnapshot: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

export const HealthResponseSchema = Schema.Struct({
	ok: Schema.Boolean,
	runtime: Schema.String,
	http: Schema.String,
});

export const WorkshopGroup = HttpApiGroup.make("workshop")
	.add(
		HttpApiEndpoint.get("health", "/api/health", {
			success: HealthResponseSchema,
		}),
	)
	.add(
		HttpApiEndpoint.post("runStage", "/api/stages/:id/run", {
			params: { id: Schema.String },
			payload: Schema.Record(Schema.String, Schema.Unknown),
			success: StageExecutionResultSchema,
			error: UnknownStageError.pipe(HttpApiSchema.status(404)),
		}),
	);

export const WorkshopApi = HttpApi.make("WorkshopApi").add(WorkshopGroup);

export const WorkshopGroupLive = HttpApiBuilder.group(WorkshopApi, "workshop", (handlers) =>
	handlers
		.handle("health", () =>
			Effect.succeed({
				ok: true,
				runtime: "effect@4.1.4",
				http: "effect/http-api + @effect/platform-node",
			}),
		)
		.handle("runStage", ({ params, payload }) =>
			pipe(
				Schema.decodeUnknownEffect(StageIdSchema)(params.id),
				Effect.mapError(() => new UnknownStageError({ stageId: params.id })),
				Effect.flatMap((stageId) =>
					pipe(
						Effect.tryPromise({
							try: () => runStageById(stageId, payload),
							catch: (error): StageExecutionResult => ({
								stageId,
								ok: false,
								statusLabel: "TYPED_ERROR",
								durationMs: 0,
								output: {
									message: error instanceof Error ? error.message : String(error),
								},
								trace: [],
							}),
						}),
						Effect.catch(Effect.succeed),
					),
				),
			),
		),
);

export const ApiRoutesLayer = HttpApiBuilder.layer(WorkshopApi).pipe(Layer.provide(WorkshopGroupLive));

const ServerConfig = Config.all({
	port: Config.Int("PORT").pipe(Config.withDefault(3000)),
	nodeEnv: Config.String("NODE_ENV").pipe(Config.withDefault("development")),
});

function runDevServer(port: number) {
	return Effect.scoped(
		Effect.scopedWith((scope) =>
			pipe(
				Effect.all({
					vite: Effect.acquireRelease(
						Effect.promise(() =>
							createViteServer({
								server: { middlewareMode: true },
								appType: "custom",
							}),
						),
						(vite) => Effect.promise(() => vite.close()),
					),
					apiEffect: HttpRouter.toHttpEffect(ApiRoutesLayer),
				}),
				Effect.flatMap(({ vite, apiEffect }) =>
					pipe(
						NodeHttpServer.makeHandler(apiEffect, { scope }),
						Effect.flatMap((apiHandler) =>
							Effect.acquireRelease(
								Effect.callback<ReturnType<typeof createServer>>((resume) => {
									const nodeServer = createServer((req, res) => {
										if ((req.url ?? "/").startsWith("/api")) {
											apiHandler(req, res);
											return;
										}
										vite.middlewares(req, res, () => {
											res.statusCode = 404;
											res.end("Not Found");
										});
									});
									nodeServer.listen(port, "0.0.0.0", () => {
										resume(Effect.succeed(nodeServer));
									});
								}),
								(nodeServer) =>
									Effect.callback<void>((resume) => {
										nodeServer.close(() => resume(Effect.void));
									}),
							),
						),
					),
				),
				Effect.tap(() => Effect.logInfo(`EffectTS Workshop (dev + Vite middleware + HttpApi) listening on http://localhost:${port}`)),
				Effect.andThen(Effect.never),
			),
		).pipe(Effect.provide(NodeHttpServer.layerHttpServices)),
	);
}

function runProdServer(port: number) {
	return pipe(
		Layer.mergeAll(
			ApiRoutesLayer,
			HttpStaticServer.layer({
				root: path.resolve(process.cwd(), "dist/client"),
				spa: true,
			}),
		),
		HttpRouter.serve,
		Layer.provide(NodeHttpServer.layer(createServer, { host: "0.0.0.0", port })),
		Layer.launch,
	);
}

const main = pipe(
	ServerConfig,
	Effect.flatMap(({ port, nodeEnv }) => (nodeEnv === "production" ? runProdServer(port) : runDevServer(port))),
);

const isDirectEntry = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectEntry) {
	NodeRuntime.runMain(main);
}
