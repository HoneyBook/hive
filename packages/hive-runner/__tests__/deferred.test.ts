import { TestKit, AsyncTestKit } from "@honeybook/hive";
import { createBaseTestRunner } from "../src/createBaseTestRunner";

// --- Async producer kit: seeds an attachment id ---
class AttachmentKit extends AsyncTestKit<{ attachmentId: string }> {
  private _id = "att_default";
  get name(): "AttachmentKit" {
    return "AttachmentKit";
  }
  withAttachment(id: string): void {
    this._id = id;
  }
  protected async build(): Promise<{ attachmentId: string }> {
    return { attachmentId: this._id };
  }
}

// --- Async consumer kit: derives its payload from AttachmentKit's resolved value ---
// Counts with* applications so we can assert the default is suppressed when deferred.
class ConversationKit extends AsyncTestKit<{
  conversationId: string;
  linkedAttachmentId: string;
  withCalls: number;
}> {
  private _linked = "none";
  private _withCalls = 0;
  get name(): "ConversationKit" {
    return "ConversationKit";
  }
  withConversation(payload: { linkedAttachmentId: string }): void {
    this._withCalls++;
    this._linked = payload.linkedAttachmentId;
  }
  defaultCallback = () => this.withConversation({ linkedAttachmentId: "default" });
  protected async build(): Promise<{
    conversationId: string;
    linkedAttachmentId: string;
    withCalls: number;
  }> {
    return {
      conversationId: "conv_1",
      linkedAttachmentId: this._linked,
      withCalls: this._withCalls,
    };
  }
}

// --- Sync kit: for the negative (throws) case ---
class CounterKit extends TestKit {
  result: { count: number } = { count: 0 };
  get name(): "CounterKit" {
    return "CounterKit";
  }
  withCount(n: number): void {
    this.result = { count: n };
  }
}

// --- Sync kits: for the eager (existing behavior) regression ---
class UserKit extends TestKit {
  result: { userId: string } = { userId: "" };
  get name(): "UserKit" {
    return "UserKit";
  }
  withUser(id: string): void {
    this.result = { userId: id };
  }
}
class ProfileKit extends TestKit {
  result: { profileFor: string } = { profileFor: "" };
  get name(): "ProfileKit" {
    return "ProfileKit";
  }
  withProfile(payload: { profileFor: string }): void {
    this.result = payload;
  }
}

describe("runner.defer() — async derived payloads", () => {
  it("derives an async with* payload from another async kit's resolved value", async () => {
    const runner = createBaseTestRunner([AttachmentKit, ConversationKit]);

    runner.withAttachment("att_99").withConversation(
      runner.defer(async (kits) => ({
        linkedAttachmentId: (await kits.AttachmentKit.value).attachmentId,
      })),
    );

    const r = await runner.run();

    expect(r.attachmentId).toBe("att_99");
    expect(r.linkedAttachmentId).toBe("att_99");
  });

  it("throws when applied to a synchronous kit's with*", () => {
    const runner = createBaseTestRunner([CounterKit, AttachmentKit]);

    expect(() => runner.withCount(runner.defer(() => 5))).toThrow(/async test kit/i);
  });

  it("suppresses the kit's defaultCallback — the deferred payload wins, applied exactly once", async () => {
    const runner = createBaseTestRunner([AttachmentKit, ConversationKit]);

    runner.withAttachment("att_7").withConversation(
      runner.defer(async (kits) => ({
        linkedAttachmentId: (await kits.AttachmentKit.value).attachmentId,
      })),
    );

    const r = await runner.run();

    // If defaultInit had also fired, linkedAttachmentId would be "default" (order) or withCalls === 2.
    expect(r.linkedAttachmentId).toBe("att_7");
    expect(r.withCalls).toBe(1);
  });

  it("still supports the eager (result) => payload derivation for sync kits at chain-time", async () => {
    const runner = createBaseTestRunner([UserKit, ProfileKit]);

    runner.withUser("u_1").withProfile((result) => ({ profileFor: result.userId }));

    const r = await runner.run();

    expect(r.profileFor).toBe("u_1");
  });
});
