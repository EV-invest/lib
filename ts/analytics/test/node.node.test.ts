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
});

describe("shutdown", () => {
  it("delegates to the client and resolves", async () => {
    const client = fakeNodeClient();
    await expect(shutdown(client)).resolves.toBeUndefined();
    expect(client.shutdown).toHaveBeenCalledTimes(1);
  });
});
