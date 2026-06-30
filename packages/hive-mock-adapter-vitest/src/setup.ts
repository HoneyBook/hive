import { afterEach } from "vitest";
import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter";

afterEach(() => cleanupMockAdapters());
