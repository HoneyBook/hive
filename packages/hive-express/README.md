# @honeybook/hive-express

Express integration for hive — a runner that mounts an Express app and exposes a supertest agent for HTTP assertions.

## Installation

```bash
pnpm add -D @honeybook/hive-express express@>=4
```

## Usage

```ts
import express from "express";
import { createExpressTestRunner } from "@honeybook/hive-express";

function makeApp() {
  const app = express();
  app.get("/ping", (_req, res) => {
    res.json({ pong: true });
  });
  return app;
}

it("mounts an Express app and makes HTTP requests", async () => {
  const runner = createExpressTestRunner([]);

  // Pass a factory because Express apps are functions;
  // the proxy invokes function args to get the actual instance
  runner.withApp(() => makeApp());

  // Optionally set headers applied to all requests
  runner.withHeaders({ "x-request-id": "test-123" });

  await runner.run();

  // runner.request is a supertest agent
  const res = await runner.request.get("/ping");
  expect(res.body).toEqual({ pong: true });

  // runner.result.app is the mounted Express app
  expect(runner.result.app).toBeDefined();
});
```

## API

- `createExpressTestRunner` — factory for an Express test runner with a supertest agent
- `EXPRESS_BASE_KITS` — the base kit set injected into every Express runner
- `ExpressBaseKits` — type of `EXPRESS_BASE_KITS`
- `RequestConfigTestKit` — kit providing `withApp`/`withHeaders` and the request agent
- `RequestConfigTestKitResult` — result type merged into `runner.result` by that kit

## Peer Dependencies

- `express: >=4`
