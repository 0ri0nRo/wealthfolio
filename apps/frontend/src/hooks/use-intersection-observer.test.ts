import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIntersectionObserver } from "./use-intersection-observer";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

interface ObserverInstance {
  callback: ObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
}

let instances: ObserverInstance[] = [];

class MockIntersectionObserver {
  instance: ObserverInstance;

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.instance = { callback, options, observed: [], disconnected: false };
    instances.push(this.instance);
  }

  observe = (element: Element) => {
    this.instance.observed.push(element);
  };

  disconnect = () => {
    this.instance.disconnected = true;
  };
}

function lastInstance(): ObserverInstance {
  const instance = instances[instances.length - 1];
  if (!instance) throw new Error("no IntersectionObserver was created");
  return instance;
}

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("observes the sentinel attached through the returned callback ref", () => {
    const element = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(vi.fn()));

    act(() => result.current(element));

    expect(instances).toHaveLength(1);
    expect(lastInstance().observed).toEqual([element]);
    expect(lastInstance().options).toEqual({ rootMargin: "100px" });
  });

  it("invokes the callback when the sentinel intersects", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useIntersectionObserver(callback));
    act(() => result.current(document.createElement("div")));

    lastInstance().callback([{ isIntersecting: true }]);
    expect(callback).toHaveBeenCalledTimes(1);

    lastInstance().callback([{ isIntersecting: false }]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("reconnects to the new sentinel when the node is replaced", () => {
    const elementA = document.createElement("div");
    const elementB = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(vi.fn()));

    act(() => result.current(elementA));
    // A layout switch detaches the old sentinel and attaches a new one.
    act(() => result.current(elementB));

    expect(instances).toHaveLength(2);
    expect(instances[0].disconnected).toBe(true);
    expect(instances[1].observed).toEqual([elementB]);
    expect(instances[1].disconnected).toBe(false);
  });

  it("disconnects and stops observing when the sentinel unmounts", () => {
    const { result } = renderHook(() => useIntersectionObserver(vi.fn()));
    act(() => result.current(document.createElement("div")));
    expect(instances).toHaveLength(1);

    act(() => result.current(null));

    expect(instances).toHaveLength(1);
    expect(lastInstance().disconnected).toBe(true);
  });

  it("invokes the latest callback after a rerender", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }: { callback: () => void }) => useIntersectionObserver(callback),
      { initialProps: { callback: first } },
    );
    act(() => result.current(document.createElement("div")));

    rerender({ callback: second });
    lastInstance().callback([{ isIntersecting: true }]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not create an observer when disabled, and connects once enabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useIntersectionObserver(vi.fn(), { enabled }),
      { initialProps: { enabled: false } },
    );
    act(() => result.current(document.createElement("div")));
    expect(instances).toHaveLength(0);

    rerender({ enabled: true });
    expect(instances).toHaveLength(1);
    expect(lastInstance().observed).toHaveLength(1);
  });

  it("disconnects the observer on unmount", () => {
    const { result, unmount } = renderHook(() => useIntersectionObserver(vi.fn()));
    act(() => result.current(document.createElement("div")));
    expect(instances).toHaveLength(1);

    unmount();
    expect(lastInstance().disconnected).toBe(true);
  });

  it("passes a custom rootMargin to the observer", () => {
    const { result } = renderHook(() => useIntersectionObserver(vi.fn(), { rootMargin: "200px" }));
    act(() => result.current(document.createElement("div")));

    expect(lastInstance().options).toEqual({ rootMargin: "200px" });
  });
});
