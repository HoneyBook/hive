import express from "express";
import { createExpressTestRunner } from "../src/createExpressTestRunner";

// ─── Inline Express app ─────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.get("/ping", (_req, res) => {
    res.json({ pong: true });
  });
  app.get("/echo-header", (req, res) => {
    res.json({ value: req.header("x-test") });
  });
  return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createExpressTestRunner", () => {
  it("runner.request is a supertest agent", async () => {
    const runner = createExpressTestRunner([]);
    // Hive's builder-support calls a function first-arg with runner.result;
    // passing () => makeApp() stores the app instance (proxy invokes the factory).
    runner.withApp(() => makeApp());
    await runner.run();
    expect(typeof runner.request.get).toBe("function");
  });

  it("runner.result.app is the app instance", async () => {
    const runner = createExpressTestRunner([]);
    const app = makeApp();
    // Express apps ARE functions — proxy always calls function first-args.
    // Wrap in a factory so the proxy calls () => app and gets back the same instance.
    runner.withApp(() => app);
    await runner.run();
    expect(runner.result.app).toBe(app);
  });

  it("HTTP roundtrip: GET /ping returns { pong: true }", async () => {
    const runner = createExpressTestRunner([]);
    runner.withApp(() => makeApp());
    await runner.run();
    const res = await runner.request.get("/ping");
    expect(res.body).toEqual({ pong: true });
  });

  it("withHeaders applied to every request", async () => {
    const runner = createExpressTestRunner([]);
    runner.withHeaders({ "x-test": "hdr-value" });
    runner.withApp(() => makeApp());
    await runner.run();
    const res = await runner.request.get("/echo-header");
    expect(res.body.value).toBe("hdr-value");
  });

  it("consumer void extraMethod still chains", () => {
    const runner = createExpressTestRunner([], {
      withCustomId(): void {
        // void extra method — chains back to runner
      },
    });
    // withCustomId() returns the runner — verify chain lands on a kit method
    runner.withCustomId().withApp(() => makeApp());
    // runner.result is accessible — RequestConfigTestKit.result is merged in
    expect(runner.result).toBeDefined();
  });
});
