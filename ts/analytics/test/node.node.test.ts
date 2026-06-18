import { describe, it, expect, vi } from "vitest";
import {
  createServerSink,
  shutdown,
  type PostHogNodeLike,
} from "../src/node/index";

function fakeNodeClient() {
  return {
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } satisfies PostHogNodeLike;
}

describe("createServerSink", () => {
  it("stamps distinctId and forwards event + properties", () => {
    const client = fakeNodeClient();
    const sink = createServerSink(client, { distinctId: "user_1" });
    sink.capture("checkout_order_placed", { amount: 42 });
    expect(client.capture).toHaveBeenCalledWith({
      distinctId: "user_1",
      event: "checkout_order_placed",
      properties: { amount: 42 },
    });
  });

  it("omits properties when none are passed", () => {
    const client = fakeNodeClient();
    const sink = createServerSink(client, { distinctId: "server" });
    sink.capture("cron_ran");
    expect(client.capture).toHaveBeenCalledWith({
      distinctId: "server",
      event: "cron_ran",
    });
  });

  it("stamps the same distinctId across multiple captures", () => {
    const client = fakeNodeClient();
    const sink = createServerSink(client, { distinctId: "user_9" });
    sink.capture("first", { a: 1 });
    sink.capture("second");
    expect(client.capture).toHaveBeenNthCalledWith(1, {
      distinctId: "user_9",
      event: "first",
      properties: { a: 1 },
    });
    expect(client.capture).toHaveBeenNthCalledWith(2, {
      distinctId: "user_9",
      event: "second",
    });
  });
});

describe("shutdown", () => {
  it("delegates to the client and resolves", async () => {
    const client = fakeNodeClient();
    await expect(shutdown(client)).resolves.toBeUndefined();
    expect(client.shutdown).toHaveBeenCalledTimes(1);
  });

  it("awaits the client and propagates a rejection", async () => {
    const client: PostHogNodeLike = {
      capture: vi.fn(),
      shutdown: vi.fn().mockRejectedValue(new Error("flush failed")),
    };
    await expect(shutdown(client)).rejects.toThrow("flush failed");
    expect(client.shutdown).toHaveBeenCalledTimes(1);
  });
});
