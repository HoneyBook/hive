import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { createTemporalTestRunner } from '@honeybook/hive-temporal';
import * as activities from '../activities.js';

// Temporal's webpack bundles this TypeScript source file at Worker.create time.
const workflowsPath = fileURLToPath(
  new URL('../testing/workflows.test-bundle.ts', import.meta.url),
);

describe('createTemporalTestRunner — integration', () => {
  it('exposes testEnv and client on the handle (no worker)', async () => {
    const runner = createTemporalTestRunner([]);
    await runner.run();
    expect(runner.testEnv).toBeDefined();
    expect(typeof runner.client.workflow).toBe('object');
    expect(runner.childTaskQueue).toBeUndefined();
  });

  it('executes echoWorkflow via a real worker', async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    await runner.run();

    const result = await runner.client.workflow.execute('echoWorkflow', {
      taskQueue: runner.taskQueue,
      workflowId: `echo-${runner.taskQueue}`,
      args: ['hello from hive'],
    });

    expect(result).toBe('hello from hive');
  });

  it('registers activities via withActivities and calls them inside a workflow', async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    runner.withActivities(activities);
    await runner.run();

    const result = await runner.client.workflow.execute('greetingWorkflow', {
      taskQueue: runner.taskQueue,
      workflowId: `greet-${runner.taskQueue}`,
      args: ['Hive'],
    });

    expect(result).toBe('Hello, Hive!');
  });

  it('allocates childTaskQueue and executes a parent→child workflow across two workers', async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    runner.withChildWorkflowsPath(workflowsPath);
    await runner.run();

    expect(runner.childTaskQueue).toBeDefined();
    expect(runner.taskQueue).not.toBe(runner.childTaskQueue);

    const result = await runner.client.workflow.execute('parentWorkflow', {
      taskQueue: runner.taskQueue,
      workflowId: `parent-${runner.taskQueue}`,
      args: ['World'],
    });

    expect(result).toBe('Child says: Hello, World!');
  });
});
