import { TestKit } from '@honeybook/hive';
import type { Application } from 'express';

export interface RequestConfigTestKitResult {
  app: Application | undefined;
  headers: Record<string, string>;
}

export class RequestConfigTestKit extends TestKit {
  result: RequestConfigTestKitResult = { app: undefined, headers: {} };

  defaultCallback = (): void => {};

  get name(): 'RequestConfigTestKit' {
    return 'RequestConfigTestKit';
  }

  withApp(app: Application): void {
    this.result.app = app;
  }

  withHeaders(headers: Record<string, string>): void {
    this.result.headers = { ...this.result.headers, ...headers };
  }
}
