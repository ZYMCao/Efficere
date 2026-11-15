import express from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import { runStageById } from "./src/effect-curriculum/runner";
import type { StageId } from "./src/effect-curriculum/types";

const VALID_STAGES = new Set<StageId>([
  "stage-01",
  "stage-02",
  "stage-03",
  "stage-04",
  "stage-05",
  "stage-06",
  "stage-07",
  "stage-08",
]);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, runtime: "effect@4.1.4" });
  });

  app.post("/api/stages/:id/run", async (req, res) => {
    const stageId = req.params.id as StageId;
    if (!VALID_STAGES.has(stageId)) {
      res.status(404).json({ error: `Unknown stage: ${stageId}` });
      return;
    }

    try {
      const input =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      const result = await runStageById(stageId, input);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        stageId,
        ok: false,
        statusLabel: "TYPED_ERROR",
        durationMs: 0,
        output: { message: error instanceof Error ? error.message : String(error) },
        trace: [],
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, "0.0.0.0", () => {
    console.log(`EffectTS Workshop listening on http://localhost:${port}`);
  });
}

startServer();
