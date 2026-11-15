import { Context, Effect, Layer, Ref, Schema, pipe } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage06Input {
  readonly method?: string;
  readonly path?: string;
  readonly recipient?: string;
  readonly subject?: string;
}

// 1. Schemas for HttpApi contract
export const DispatchItemSchema = Schema.Struct({
  id: Schema.String,
  recipient: Schema.String,
  subject: Schema.String,
  status: Schema.Literals(["queued", "delivered"]),
});

export class DispatchNotFound extends Schema.TaggedError<DispatchNotFound>()(
  "DispatchNotFound",
  { id: Schema.String }
) {}

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
    })
  )
  .add(
    HttpApiEndpoint.get("getById", "/dispatches/:id", {
      params: { id: Schema.NonEmptyString },
      success: DispatchItemSchema,
      error: DispatchNotFound.pipe(HttpApiSchema.status(404)),
    })
  );

export const LedgerApi = HttpApi.make("LedgerApi").add(DispatchGroup);

// 3. Domain store service required by the endpoint handlers
export class DispatchStore extends Context.Service<
  DispatchStore,
  {
    readonly create: (
      recipient: string,
      subject: string
    ) => Effect.Effect<typeof DispatchItemSchema.Type>;
    readonly findById: (
      id: string
    ) => Effect.Effect<typeof DispatchItemSchema.Type, DispatchNotFound>;
    readonly snapshot: Effect.Effect<ReadonlyArray<typeof DispatchItemSchema.Type>>;
  }
>()("DispatchStore") {}

export const DispatchStoreLive = Layer.effect(
  DispatchStore,
  pipe(
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
      ])
    ),
    Effect.map((storeRef) => ({
      create: (recipient, subject) =>
        pipe(
          Ref.modify(storeRef, (map) => {
            const id = `disp-${101 + map.size}`;
            const item: typeof DispatchItemSchema.Type = {
              id,
              recipient,
              subject,
              status: "queued",
            };
            const next = new Map(map);
            next.set(id, item);
            return [item, next] as const;
          })
        ),
      findById: (id) =>
        pipe(
          Ref.get(storeRef),
          Effect.flatMap((map) => {
            const found = map.get(id);
            return found
              ? Effect.succeed(found)
              : Effect.fail(new DispatchNotFound({ id }));
          })
        ),
      snapshot: pipe(
        Ref.get(storeRef),
        Effect.map((map) => Array.from(map.values()))
      ),
    }))
  )
);

// 4. Implement HttpApiGroup handlers via pure pipelines
export const DispatchGroupLive = HttpApiBuilder.group(
  LedgerApi,
  "dispatches",
  (handlers) =>
    pipe(
      DispatchStore,
      Effect.map((store) =>
        handlers
          .handle("create", ({ payload }) =>
            store.create(payload.recipient, payload.subject)
          )
          .handle("getById", ({ params }) => store.findById(params.id))
      )
    )
);

// 5. Build Web-standard Request -> Response handler with HttpRouter.toWebHandler
export const ApiLayer = HttpApiBuilder.layer(LedgerApi).pipe(
  Layer.provide(DispatchGroupLive),
  Layer.provide(DispatchStoreLive),
  Layer.provide(HttpServer.layerServices)
);

export const runStage06 = (input: Stage06Input): Promise<StageExecutionResult> => {
  const startedAt = performance.now();
  const method = input.method === "GET" ? "GET" : "POST";
  const path =
    method === "GET"
      ? (input.path ?? "/dispatches/disp-101").trim()
      : "/dispatches";
  const recipient = (input.recipient ?? "cto@acme.dev").trim();
  const subject = (input.subject ?? "Quarterly Audit Ready").trim();
  const trace: Array<TraceEvent> = [];

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

  pushTrace(
    "HttpApiBuilder",
    "HttpRouter.toWebHandler",
    `Compiled LedgerApi routes and OpenAPI metadata`
  );

  const webApp = HttpRouter.toWebHandler(ApiLayer, { disableLogger: true });

  const request =
    method === "POST"
      ? new Request(`http://localhost${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipient, subject }),
        })
      : new Request(`http://localhost${path}`, { method: "GET" });

  pushTrace("HttpServerRequest", `${method} ${path}`, "Dispatched Web Request into Effect HttpRouter");

  const runEffect = Effect.acquireUseRelease(
    Effect.succeed(webApp),
    ({ handler }) =>
      pipe(
        Effect.promise(() => handler(request)),
        Effect.flatMap((response) =>
          pipe(
            Effect.promise(() => response.text()),
            Effect.map((rawText) => {
              let parsedBody: unknown = rawText;
              try {
                parsedBody = JSON.parse(rawText);
              } catch {
                parsedBody = rawText;
              }
              return {
                httpStatus: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: parsedBody,
              };
            })
          )
        )
      ),
    ({ dispose }) => Effect.promise(() => dispose())
  );

  return Effect.runPromise(runEffect).then((httpRes) => {
    const isOk = httpRes.httpStatus >= 200 && httpRes.httpStatus < 300;
    pushTrace(
      "HttpServerResponse",
      `HTTP ${httpRes.httpStatus}`,
      isOk
        ? "Schema-encoded response returned cleanly"
        : `Mapped typed error / schema rejection to HTTP ${httpRes.httpStatus}`,
      isOk ? "ok" : "error"
    );

    return {
      stageId: "stage-06",
      ok: isOk,
      statusLabel: isOk ? "COMPLETED" : "TYPED_ERROR",
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      output: httpRes,
      errorTag: isOk ? undefined : `HTTP_${httpRes.httpStatus}`,
      trace,
      stateSnapshot: {
        endpoints: ["POST /dispatches", "GET /dispatches/:id"],
        note: "In production, swap HttpRouter.toWebHandler for HttpRouter.serve(ApiLayer).pipe(Layer.provide(NodeHttpServer.layer(...))).",
      },
    };
  });
};
