import { TestKit } from "@honeybook/hive";
import type { Application } from "express";

export interface RequestConfigTestKitResult {
  app: Application | undefined;
  headers: Record<string, string>;
  cookies: string[];
}

export class RequestConfigTestKit extends TestKit {
  result: RequestConfigTestKitResult = { app: undefined, headers: {}, cookies: [] };

  defaultCallback = (): void => {};

  get name(): "RequestConfigTestKit" {
    return "RequestConfigTestKit";
  }

  withApp(app: Application): void {
    this.result.app = app;
  }

  withHeaders(headers: Record<string, string>): void {
    this.result.headers = { ...this.result.headers, ...headers };
  }

  /**
   * Accepts raw Set-Cookie strings (e.g. from Headers.getSetCookie() on a real
   * auth response) and seeds them into the agent's real cookie jar — not a
   * static header — so consumers can inspect/expire/override individual
   * cookies via runner.request.jar afterward, the same way a real client
   * would. See createExpressTestRunner's execute() for the jar-seeding side.
   */
  withCookies(setCookieStrings: string[]): void {
    this.result.cookies = [...this.result.cookies, ...setCookieStrings];
  }
}
