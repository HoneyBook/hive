import express from "express";
import { createExpressTestRunner } from "../src/createExpressTestRunner.test-runner";

// ─── Inline Express app ─────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.get("/ping", (_req, res) => {
    res.json({ pong: true });
  });
  app.get("/echo-header", (req, res) => {
    res.json({ value: req.header("x-test") });
  });
  app.get("/echo-cookies", (req, res) => {
    res.json({ cookies: req.headers.cookie ?? null });
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

  it("withCookies seeds the agent's real cookie jar (sent on requests)", async () => {
    const runner = createExpressTestRunner([]);
    runner.withCookies(["session_token=abc123; Path=/", "session_cache=cached-value; Path=/"]);
    runner.withApp(() => makeApp());
    await runner.run();

    const res = await runner.request.get("/echo-cookies");
    expect(res.body.cookies).toContain("session_token=abc123");
    expect(res.body.cookies).toContain("session_cache=cached-value");
  });

  it("withCookies-seeded cookies can be individually expired via the jar afterward", async () => {
    const runner = createExpressTestRunner([]);
    runner.withCookies(["session_token=abc123; Path=/", "session_cache=cached-value; Path=/"]);
    runner.withApp(() => makeApp());
    await runner.run();

    // A real client would drop an expired cookie entirely before sending the
    // next request — this must line up with the domain execute() seeds
    // cookies against (127.0.0.1), or the jar treats it as an unrelated,
    // non-colliding cookie and the original is never overridden.
    runner.request.jar.setCookies(
      "session_cache=; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "127.0.0.1",
      "/",
    );

    const res = await runner.request.get("/echo-cookies");
    expect(res.body.cookies).toContain("session_token=abc123");
    expect(res.body.cookies).not.toContain("session_cache");
  });

  it("withCookies and withHeaders compose — cookie jar and static headers both apply", async () => {
    const runner = createExpressTestRunner([]);
    runner.withCookies(["session_token=abc123; Path=/"]);
    runner.withHeaders({ "x-test": "hdr-value" });
    runner.withApp(() => makeApp());
    await runner.run();

    const cookieRes = await runner.request.get("/echo-cookies");
    expect(cookieRes.body.cookies).toContain("session_token=abc123");
    const headerRes = await runner.request.get("/echo-header");
    expect(headerRes.body.value).toBe("hdr-value");
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

// ─── Type contract (compile-time; anchors the RunnerFactory ban + anti-any surface) ─────────
describe("createExpressTestRunner — type contract", () => {
  it("bans explicit undefined for extraMethods and does not degrade to any", () => {
    // @ts-expect-error — undefined matches neither overload; pass {} to skip extraMethods.
    createExpressTestRunner([], undefined);

    const runner = createExpressTestRunner([], {});
    // @ts-expect-error — {} must NOT widen the runner to admit arbitrary methods.
    const bogusMethod = runner.withNopeDoesNotExist;
    // @ts-expect-error — result must not be `any`; this property does not exist.
    const bogusResult = runner.result.nopeDoesNotExist;
    expect(bogusMethod).toBeUndefined();
    expect(bogusResult).toBeUndefined();
    expect(runner).toBeDefined();
  });
});
