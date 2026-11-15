import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { ApiRoutesLayer } from "./server";

test("src/server.ts uses Effect HTTP natively without Express or generators", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/server.ts"), "utf8");
  assert.equal(source.includes("express"), false);
  assert.equal(source.includes("Effect.gen"), false);
  assert.equal(source.includes("yield*"), false);
  assert.equal(/function\s*\*/.test(source), false);
});

test("WorkshopApi serves /api/health, /api/stages/:id/run, and 404 on unknown stage", async () => {
  const { handler, dispose } = HttpRouter.toWebHandler(
    ApiRoutesLayer.pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  );

  try {
    const healthRes = await handler(new Request("http://localhost/api/health"));
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as {
      ok: boolean;
      runtime: string;
      http: string;
    };
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.runtime, "effect@4.1.4");

    const runRes = await handler(
      new Request("http://localhost/api/stages/stage-01/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: "ops@acme.dev",
          message: "Effect HTTP live",
        }),
      }),
    );
    assert.equal(runRes.status, 200);
    const runBody = (await runRes.json()) as { ok: boolean; stageId: string };
    assert.equal(runBody.ok, true);
    assert.equal(runBody.stageId, "stage-01");

    const unknownRes = await handler(
      new Request("http://localhost/api/stages/stage-99/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    assert.equal(unknownRes.status, 404);
  } finally {
    await dispose();
  }
});
