// Worker entry point for integration tests.
// Re-exports all test workflows so a single Worker can handle any of them.
export { echoWorkflow, greetingWorkflow, parentWorkflow, childWorkflow } from '../workflows.js';
