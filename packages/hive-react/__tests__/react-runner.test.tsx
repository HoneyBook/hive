import React from "react";
import { act, screen, buildQueries } from "@testing-library/react";
import { TestKit } from "@honeybook/hive";
import type { IProviderTestKit } from "../src/IProviderTestKit";
import { createReactTestRunner } from "../src/createReactTestRunner.test-runner";
import { createReactTestRunnerWithQueries } from "../src/createReactTestRunnerWithQueries.test-runner";

// A kit that mounts real content via Provider() — mirrors honeybook-react's
// LayoutAppTestKit pattern, where render() is called with zero arguments and
// the content under test lives inside the provider stack instead.
class ContentProviderKit extends TestKit implements IProviderTestKit {
  result = {};
  get name() {
    return "ContentProviderKit";
  }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="content-under-test">
        <span>mounted via Provider, not via render() argument</span>
        {children}
      </div>
    );
  }
}

// ─── Test kits ─────────────────────────────────────────────────────────────

class OuterKit extends TestKit implements IProviderTestKit {
  result = { outer: true };
  get name() {
    return "OuterKit";
  }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="outer">{children}</div>
    );
  }
}

class InnerKit extends TestKit implements IProviderTestKit {
  result = { inner: true };
  get name() {
    return "InnerKit";
  }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="inner">{children}</div>
    );
  }
}

class UserKit extends TestKit {
  result: { userId: string } = { userId: "default" };
  get name() {
    return "UserKit";
  }
  withUserId(id: string) {
    this.result = { userId: id };
  }
  defaultCallback = () => this.withUserId("default");
}

// A kit whose Provider() supplies a real React Context — used to verify renderHook() drives
// hooks through the SAME provider stack (via rtlRender's `wrapper` option) that render() does,
// not just a bare, unwrapped render.
const TestContext = React.createContext("no-provider");

class ContextProviderKit extends TestKit implements IProviderTestKit {
  result = { contextValue: "from-provider" };
  get name() {
    return "ContextProviderKit";
  }
  defaultCallback = () => {};
  Provider() {
    const { contextValue } = this.result;
    return ({ children }: { children?: React.ReactNode }) => (
      <TestContext.Provider value={contextValue}>
        <div data-testid="context-provider">{children}</div>
      </TestContext.Provider>
    );
  }
}

function useTestContextValue() {
  return React.useContext(TestContext);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("createReactTestRunner", () => {
  it("render() fires run() without awaiting and returns runner.result with RTL result nested under .ui", async () => {
    const runner = createReactTestRunner([UserKit]);
    const result = runner.render(<div data-testid="target">hello</div>);
    expect(result.ui.getByTestId("target").textContent).toBe("hello");
    await expect(runner.run()).resolves.toBeDefined();
  });

  it("renderHook() returns the same merged shape as runner.result, widened with current/rerender/unmount — not a bespoke narrower object", () => {
    const runner = createReactTestRunner([UserKit]);
    // Not a reference-identity check — runner.result (hive's TestAppRunner) is a getter that
    // recomputes a fresh merged object on every single access, so no two reads of it (or of
    // renderHook()'s return, which is one such read) are ever the same object. What matters is
    // that renderHook()'s return carries everything a bare runner.result read would.
    // BaseMethods are intersected directly (not through RunnerMethodMap), so
    // renderHook<Result, Props> generics are preserved — no cast needed.
    const result = runner.renderHook(() => ({ value: 42 }));
    const value: number = result.current.value;
    expect(value).toBe(42);
    // Same merged shape also still carries the seeded kit result (UserKit's userId), same as
    // render()/renderComponent() — confirms this isn't a separate, narrower object.
    expect(result.userId).toBe("default");
    expect(result.ui).toBeDefined();
  });

  it("renderHook(): .current is only live via a fresh runner.result read, not the captured return value", () => {
    const runner = createReactTestRunner([UserKit]);
    // Same discipline `runner.result.userId` already requires after `withUserId(...)` — `result`
    // below is a one-time snapshot (runner.result is a getter that recomputes on every access),
    // so `.rerender()`/`.unmount()` (real, stable closures) can be called off it safely, but
    // `.current` after that call must be re-read via `runner.result`, not the old snapshot.
    const result = runner.renderHook((n: number) => n * 2, { initialProps: 3 });
    expect(result.current).toBe(6);
    result.rerender(5);
    expect(runner.result.current).toBe(10);
  });

  it("renderHook(): rerender() without new props re-invokes the hook with the last props", () => {
    const runner = createReactTestRunner([UserKit]);
    let callCount = 0;
    const result = runner.renderHook(
      (n: number) => {
        callCount += 1;
        return n;
      },
      { initialProps: 7 },
    );
    expect(result.current).toBe(7);
    result.rerender();
    expect(callCount).toBe(2);
    expect(runner.result.current).toBe(7);
  });

  it("renderHook(): unmount() tears down the rendered hook consumer and flushes cleanup effects", () => {
    const runner = createReactTestRunner([UserKit]);
    const cleanup = jest.fn();
    const result = runner.renderHook(() => {
      React.useEffect(() => cleanup, []);
      return null;
    });
    expect(cleanup).not.toHaveBeenCalled();
    result.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("renderHook(): supports stateful hooks — useState updates are visible via act() + rerender", () => {
    const runner = createReactTestRunner([UserKit]);
    function useCounter() {
      const [count, setCount] = React.useState(0);
      return { count, increment: () => setCount((c) => c + 1) };
    }
    const result = runner.renderHook(useCounter);
    expect(result.current.count).toBe(0);
    act(() => result.current.increment());
    // A bare runner.result read can't know which Result type a prior renderHook() call used —
    // that generic only narrows the RETURN VALUE of the specific renderHook() call itself
    // (result.current above, typed via `this['result'] & RenderHookResult<Result, Props>`).
    // Re-reading through runner.result for liveness costs that narrowing; cast it back.
    const current = runner.result.current as ReturnType<typeof useCounter>;
    expect(current.count).toBe(1);
  });

  it("renderHook(): the hook is rendered inside the runner's provider stack — same wrapper as render()", () => {
    const runner = createReactTestRunner([ContextProviderKit]);
    const result = runner.renderHook(useTestContextValue);
    expect(result.current).toBe("from-provider");
    // Confirms it's the SAME rtlRender(...) + `wrapper` option path render() uses, not a
    // bare unwrapped render — the provider's own DOM markup is seeded into runner.result.ui too.
    expect(runner.result.ui.getByTestId("context-provider")).toBeTruthy();
  });

  it("renderHook(): getProviders wraps INSIDE the kit provider stack, same as render()", () => {
    const runner = createReactTestRunner(
      [OuterKit],
      {},
      () =>
        ({ children }: { children?: React.ReactNode }) => <div data-testid="extra">{children}</div>,
    );
    runner.renderHook(() => null);
    const outer = screen.getByTestId("outer");
    const extra = screen.getByTestId("extra");
    expect(outer.contains(extra)).toBe(true);
  });

  it("renderHook(): withBeforeRender fires exactly once (at initial render), not again on rerender()", () => {
    const runner = createReactTestRunner([UserKit]);
    let fireCount = 0;
    runner.withBeforeRender(() => {
      fireCount += 1;
    });
    const { rerender } = runner.renderHook((n: number) => n, { initialProps: 1 });
    expect(fireCount).toBe(1);
    rerender(2);
    rerender(3);
    expect(fireCount).toBe(1);
  });

  it("renderHook(): sequential rerenders each reflect the newly passed props, in order", () => {
    const runner = createReactTestRunner([UserKit]);
    const seen: number[] = [];
    const result = runner.renderHook(
      (n: number) => {
        seen.push(n);
        return n;
      },
      { initialProps: 1 },
    );
    result.rerender(2);
    result.rerender(3);
    expect(seen).toEqual([1, 2, 3]);
    expect(runner.result.current).toBe(3);
  });

  it("renderHook(): a hook that throws during render propagates the error, not swallowed", () => {
    const runner = createReactTestRunner([UserKit]);
    expect(() =>
      runner.renderHook(() => {
        throw new Error("boom from inside the hook");
      }),
    ).toThrow("boom from inside the hook");
  });

  it("provider stack: first kit in array = outermost provider", () => {
    const runner = createReactTestRunner([OuterKit, InnerKit]);
    runner.render(<span data-testid="child">content</span>);
    const outer = screen.getByTestId("outer");
    const inner = screen.getByTestId("inner");
    expect(outer.contains(inner)).toBe(true);
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("consumer non-void extraMethod returns its actual value", () => {
    const runner = createReactTestRunner([UserKit], {
      getValue(): string {
        return "from-extra";
      },
    });
    const v = runner.getValue();
    expect(v).toBe("from-extra");
  });

  it("consumer void extraMethod still chains", () => {
    const runner = createReactTestRunner([UserKit], {
      withCustomId(): void {
        // void extra method
      },
    });
    // withCustomId() returns the runner — verify the chain lands on a kit method, then a
    // render method (render/renderHook) at the end of the same chain. BaseMethods are threaded
    // through the Handle position, so they survive `with*()` chaining (see the chaining
    // regression test below).
    const result = runner
      .withCustomId()
      .withUserId("chained-test")
      .render(<div data-testid="chained">ok</div>);
    expect(result.ui.getByTestId("chained")).toBeTruthy();
  });

  it("render methods survive with*() chaining — runner.withX().render()/.renderHook() type-check and work (regression for the top-level-intersection drop)", () => {
    const runner = createReactTestRunner([UserKit]);
    // The advertised chainable API (README/AGENTS): with*() then a render method on the SAME
    // chain. Previously render/renderHook were intersected at the top level, so they were
    // dropped from the static type after the first with*() — the whole reason the honeybook-react
    // wrapper had to re-thread them manually. Threading BaseMethods through Handle fixes it.
    const rendered = runner.withUserId("chain-render").render(<div data-testid="c">x</div>);
    expect(rendered.userId).toBe("chain-render");
    expect(rendered.ui.getByTestId("c")).toBeTruthy();

    const hookRunner = createReactTestRunner([UserKit]);
    const hookResult = hookRunner.withUserId("chain-hook").renderHook(() => 42);
    expect(hookResult.current).toBe(42);
    expect(hookResult.userId).toBe("chain-hook");

    // withBeforeRender is also a base method — it too must remain chainable off a kit with*().
    const brRunner = createReactTestRunner([UserKit]);
    const seen: string[] = [];
    brRunner
      .withUserId("chain-br")
      .withBeforeRender((r) => seen.push(r.userId))
      .render(<div data-testid="br-chain">y</div>);
    expect(seen).toEqual(["chain-br"]);
  });

  it("getProviders wraps INSIDE the kit provider stack", () => {
    const runner = createReactTestRunner(
      [OuterKit],
      {},
      () =>
        ({ children }: { children?: React.ReactNode }) => <div data-testid="extra">{children}</div>,
    );
    runner.render(<span data-testid="inner-content">x</span>);
    const outer = screen.getByTestId("outer");
    const extra = screen.getByTestId("extra");
    expect(outer.contains(extra)).toBe(true);
  });

  it("runner.result contains both kit results and the RTL render result nested under .ui after render", () => {
    const runner = createReactTestRunner([UserKit]);
    runner.withUserId("test-123");
    runner.render(<div data-testid="check">rendered</div>);
    // Kit result — typed on runner.result
    expect(runner.result.userId).toBe("test-123");
    // RTL result seeded into runner.result.ui via ReactTestKit; ReactTestKit is now in BaseKits
    // so runner.result.ui.getByTestId is available without any cast.
    expect(runner.result.ui.getByTestId("check").textContent).toBe("rendered");
  });

  it("withBeforeRender: is chainable and returns the same runner", () => {
    const runner = createReactTestRunner([UserKit]);
    expect(runner.withBeforeRender(() => {})).toBe(runner);
  });

  it("withBeforeRender: single callback fires before render() with the seeded result", () => {
    const runner = createReactTestRunner([UserKit]);
    const seen: string[] = [];
    runner.withUserId("br-render");
    runner.withBeforeRender((result) => {
      seen.push(result.userId);
    });
    const result = runner.render(<div data-testid="br">x</div>);
    expect(seen).toEqual(["br-render"]);
    expect(result.ui.getByTestId("br")).toBeTruthy();
  });

  it("withBeforeRender: fires before renderComponent() and before function-form component resolves", () => {
    const runner = createReactTestRunner([UserKit]);
    const order: string[] = [];
    runner.withUserId("br-comp");
    runner.withBeforeRender((result) => order.push(`before:${result.userId}`));
    runner.renderComponent((result) => {
      order.push(`component:${result.userId}`);
      return <div data-testid="brc">y</div>;
    });
    expect(order).toEqual(["before:br-comp", "component:br-comp"]);
  });

  it("render()'s return type reflects the full merged kit list, not just base kits — regression for the BaseKits-only widening gap", () => {
    const runner = createReactTestRunner([UserKit]);
    runner.withUserId("widen-render");
    const result = runner.render(<div data-testid="widen-render">x</div>);
    // Prior to the fix, `result` was typed CombinedTestKitsResult<InstanceType<ReactBaseKits[number]>[]>
    // (ReactTestKit only) — `result.userId` would not type-check even though it exists at runtime.
    const userId: string = result.userId;
    expect(userId).toBe("widen-render");
  });

  it("renderComponent()'s function-form param reflects the full merged kit list — regression for the BaseKits-only widening gap", () => {
    const runner = createReactTestRunner([UserKit]);
    runner.withUserId("widen-comp");
    let capturedUserId = "";
    runner.renderComponent((result) => {
      capturedUserId = result.userId;
      return <div data-testid="widen-comp">y</div>;
    });
    expect(capturedUserId).toBe("widen-comp");
  });

  it("withBeforeRender: fires before renderHook()", () => {
    const runner = createReactTestRunner([UserKit]);
    const seen: string[] = [];
    runner.withUserId("br-hook");
    runner.withBeforeRender((result) => seen.push(result.userId));
    runner.renderHook(() => ({ value: 1 }));
    expect(seen).toEqual(["br-hook"]);
  });

  it("withBeforeRender: multiple chained callbacks all fire in registration order (accumulate, no clobber)", () => {
    const runner = createReactTestRunner([UserKit]);
    const order: string[] = [];
    runner
      .withBeforeRender(() => order.push("first"))
      .withBeforeRender(() => order.push("second"))
      .withBeforeRender(() => order.push("third"));
    runner.render(<div data-testid="acc">z</div>);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("render() supports being called with no component — content supplied via a kit's Provider() — regression for the mandatory-component-arg bug", () => {
    const runner = createReactTestRunner([ContentProviderKit]);
    runner.render();
    expect(screen.getByTestId("content-under-test")).toBeTruthy();
  });

  it("renderComponent() supports being called with no component — regression for the mandatory-component-arg bug", () => {
    const runner = createReactTestRunner([ContentProviderKit]);
    runner.renderComponent();
    expect(screen.getByTestId("content-under-test")).toBeTruthy();
  });

  it("passing undefined for extraMethods is a compile error — the ban (skip it with {}, never undefined)", () => {
    const getProviders =
      () =>
      ({ children }: { children?: React.ReactNode }) => <>{children}</>;
    // @ts-expect-error — undefined matches neither overload. TypeScript does not apply
    // ExtraMethods's default for an explicit undefined (only for an omitted arg) and would
    // otherwise resolve it to the index-signature constraint, silently readmitting any method
    // name on the runner. The ban makes it a hard error; pass {} to skip extraMethods.
    createReactTestRunner([UserKit], undefined, getProviders);
    // The supported form compiles and does not widen:
    const runner = createReactTestRunner([UserKit], {}, getProviders);
    // @ts-expect-error — {} must NOT widen the runner to admit arbitrary methods.
    const bogus = runner.withThisMethodDoesNotExist;
    expect(bogus).toBeUndefined();
  });

  it("does not accidentally degrade to any anywhere on the runner surface — bogus property/method access must fail to compile", () => {
    const runner = createReactTestRunner([UserKit]);
    runner.withUserId("no-any-check");
    const result = runner.render(<div data-testid="no-any-check">x</div>);

    // If `runner` had degraded to `any`, this bogus with* method would compile,
    // and the directive below would then fail as an "unused directive", failing tsc.
    // @ts-expect-error — runner must not be `any`; this with* method does not exist
    const bogusWith = runner.withThisMethodDoesNotExist;
    expect(bogusWith).toBeUndefined();

    // Same check on render()'s return value (runner.result).
    // @ts-expect-error — result must not be `any`; this property does not exist
    const bogusResult = result.thisPropertyDoesNotExist;
    expect(bogusResult).toBeUndefined();

    // Same check on the nested RTL result (result.ui) — the .ui-nesting fix's own surface.
    // @ts-expect-error — result.ui must not be `any`; this RTL query does not exist
    const bogusQuery = result.ui.thisQueryDoesNotExist;
    expect(bogusQuery).toBeUndefined();
  });
});

describe("createReactTestRunnerWithQueries", () => {
  it("renderHook() works the same as the base variant — confirms the type wiring here too", () => {
    const runner = createReactTestRunnerWithQueries([UserKit]);
    const result = runner.renderHook((n: number) => n + 1, { initialProps: 1 });
    expect(result.current).toBe(2);
    result.rerender(10);
    expect(runner.result.current).toBe(11);
    result.unmount();
  });

  it("render methods survive with*() chaining in the queries variant too — runner.withX().render()/.renderHook()", () => {
    const runner = createReactTestRunnerWithQueries([UserKit]);
    const rendered = runner.withUserId("q-chain").render(<div data-testid="qc">x</div>);
    expect(rendered.userId).toBe("q-chain");
    expect(rendered.ui.getByTestId("qc")).toBeTruthy();

    const hookRunner = createReactTestRunnerWithQueries([UserKit]);
    const hookResult = hookRunner.withUserId("q-hook").renderHook((n: number) => n + 1, {
      initialProps: 1,
    });
    expect(hookResult.current).toBe(2);
    expect(hookResult.userId).toBe("q-hook");
  });

  it("custom queries: runner.result exposes custom query methods", () => {
    // Define a simple custom query by data-custom attribute
    const queryAllByDataCustom = (container: HTMLElement, value: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-custom="${value}"]`));
    const [, , getByDataCustom] = buildQueries(
      queryAllByDataCustom,
      (_c, v) => `Found multiple elements with data-custom="${v}"`,
      (_c, v) => `Unable to find element with data-custom="${v}"`,
    );
    const customQueries = { queryAllByDataCustom, getByDataCustom };

    // extraMethods is {} (not undefined) — the ban requires skipping it with {} to reach
    // the later positional args; getProviders stays undefined (a genuine optional, no footgun).
    const runner = createReactTestRunnerWithQueries([UserKit], {}, undefined, customQueries);
    runner.render(<div data-custom="foo">bar</div>);
    const el = runner.result.ui.getByDataCustom("foo") as HTMLElement;
    expect(el.textContent).toBe("bar");
  });

  it("passing undefined for extraMethods is a compile error in the queries variant too — the exact shape T-11b uses", () => {
    const queryAllByDataCustom = (container: HTMLElement, value: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-custom="${value}"]`));
    const [, , getByDataCustom] = buildQueries(
      queryAllByDataCustom,
      (_c, v) => `dup ${v}`,
      (_c, v) => `missing ${v}`,
    );
    const customQueries = { queryAllByDataCustom, getByDataCustom };
    // @ts-expect-error — undefined for extraMethods matches neither overload; pass {} to skip it.
    createReactTestRunnerWithQueries([UserKit], undefined, undefined, customQueries);
    // The supported form (extraMethods = {}) compiles:
    const runner = createReactTestRunnerWithQueries([UserKit], {}, undefined, customQueries);
    expect(runner).toBeDefined();
  });

  it("withBeforeRender: callbacks fire before render() in the queries variant", () => {
    const runner = createReactTestRunnerWithQueries([UserKit]);
    const seen: string[] = [];
    runner.withUserId("brq");
    runner.withBeforeRender((result) => seen.push(result.userId));
    runner.render(<div data-testid="brq">q</div>);
    expect(seen).toEqual(["brq"]);
  });

  it("render() supports being called with no component in the queries variant — regression for the mandatory-component-arg bug", () => {
    const runner = createReactTestRunnerWithQueries([ContentProviderKit]);
    runner.render();
    expect(screen.getByTestId("content-under-test")).toBeTruthy();
  });

  it("render()'s declared return type threads the caller's custom Q, not just the runtime value — regression for the Q-erasure bug", () => {
    const queryAllByDataCustom = (container: HTMLElement, value: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-custom="${value}"]`));
    const [, , getByDataCustom] = buildQueries(
      queryAllByDataCustom,
      (_c, v) => `dup ${v}`,
      (_c, v) => `missing ${v}`,
    );
    const customQueries = { queryAllByDataCustom, getByDataCustom };
    // extraMethods is {} (not undefined) — the ban requires skipping it with {} to reach
    // the later positional args; getProviders stays undefined (a genuine optional, no footgun).
    const runner = createReactTestRunnerWithQueries([UserKit], {}, undefined, customQueries);
    runner.render(<div data-custom="foo">bar</div>);

    // Type-level assertion, not just a runtime call: a concretely-typed consumer
    // (mirrors honeybook-react's driver-constructor pattern) must accept `.ui`
    // without needing a cast. A loose `.getByDataCustom(...)` call does NOT catch
    // this bug — Q's wide default bound structurally admits any method name.
    function consume(ui: { getByDataCustom(value: string): HTMLElement }) {
      return ui;
    }
    const el = consume(runner.result.ui).getByDataCustom("foo");
    expect(el.textContent).toBe("bar");
  });

  it("does not accidentally degrade to any anywhere on the queries-variant runner surface — bogus property/method access must fail to compile", () => {
    const queryAllByDataCustom = (container: HTMLElement, value: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-custom="${value}"]`));
    const [, , getByDataCustom] = buildQueries(
      queryAllByDataCustom,
      (_c, v) => `dup ${v}`,
      (_c, v) => `missing ${v}`,
    );
    const customQueries = { queryAllByDataCustom, getByDataCustom };
    // extraMethods is {} (not undefined) — the ban requires skipping it with {} to reach
    // the later positional args; getProviders stays undefined (a genuine optional, no footgun).
    const runner = createReactTestRunnerWithQueries([UserKit], {}, undefined, customQueries);
    runner.withUserId("no-any-check-q");
    const result = runner.render(<div data-custom="foo">bar</div>);

    // @ts-expect-error — runner must not be `any`; this with* method does not exist
    const bogusWith = runner.withThisMethodDoesNotExist;
    expect(bogusWith).toBeUndefined();

    // @ts-expect-error — result must not be `any`; this property does not exist
    const bogusResult = result.thisPropertyDoesNotExist;
    expect(bogusResult).toBeUndefined();

    // The Q-threading fix's own surface — result.ui must stay narrowed to the
    // caller's actual custom query set, not widen to `any` or the default Queries.
    // @ts-expect-error — result.ui must not be `any`; this query does not exist
    const bogusQuery = result.ui.thisQueryDoesNotExist;
    expect(bogusQuery).toBeUndefined();

    // @ts-expect-error — result.ui must not be `any`; even a REAL default-query
    // method (getByRole) must not resolve, since Q here is the narrow custom set,
    // not the default RTL query set — this specifically guards against Bug 2's
    // regression mode (Q silently widening back to `typeof defaultQueries`).
    const bogusDefaultQuery = result.ui.getByRole;
    expect(bogusDefaultQuery).toBeUndefined();
  });
});
