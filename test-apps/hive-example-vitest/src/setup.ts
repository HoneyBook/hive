import { cleanupMockAdapters } from "@honeybook/hive-mock-adapter-vitest";
import { beforeEach } from "vitest";

beforeEach(() => cleanupMockAdapters());
