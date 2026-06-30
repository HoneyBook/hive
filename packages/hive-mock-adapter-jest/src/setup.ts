import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter";

// afterEach is a jest global — available in setupFilesAfterEnv context
afterEach(() => cleanupMockAdapters());
