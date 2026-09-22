import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClickToLoad, YouTubeFacade } from "../src/react/index";

describe("ClickToLoad", () => {
  function Map({ onLoad }: { onLoad?: () => void }) {
    return (
      <ClickToLoad
        {...(onLoad ? { onLoad } : {})}
        placeholder={load => (
          <button type="button" onClick={load}>
            Show map
          </button>
        )}
      >
        <iframe title="Map" src="https://maps.example/embed" />
      </ClickToLoad>
    );
  }

  it("mounts no iframe until the placeholder is activated", () => {
    const { container } = render(<Map />);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("mounts the widget on activation, focuses it, and reports once", () => {
    const onLoad = vi.fn();
    const { container } = render(<Map onLoad={onLoad} />);
    act(() => fireEvent.click(screen.getByText("Show map")));
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(document.activeElement).toBe(frame);
    expect(screen.queryByText("Show map")).toBeNull();
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe("YouTubeFacade", () => {
  const props = { videoId: "abc123", title: "Leak repair", playLabel: "Play: Leak repair" };

  it("holds only a poster and a button before play — no player request", () => {
    const { container } = render(<YouTubeFacade {...props} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    );
  });

  it("falls back to hqdefault, then to no poster, instead of re-erroring", () => {
    render(<YouTubeFacade {...props} />);
    act(() => fireEvent.error(screen.getByRole("img")));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    );
    act(() => fireEvent.error(screen.getByRole("img")));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: props.playLabel })).toBeInTheDocument();
  });

  it("treats YouTube's 120px 'missing still' JPEG as a miss, not a poster", () => {
    render(<YouTubeFacade {...props} />);
    const img = screen.getByRole("img");
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 120 });
    act(() => fireEvent.load(img));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    );
  });

  it("keeps a real still that loaded", () => {
    render(<YouTubeFacade {...props} />);
    const img = screen.getByRole("img");
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 1280 });
    act(() => fireEvent.load(img));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    );
  });

  it("loads the privacy-preserving player on play", () => {
    const onPlay = vi.fn();
    const { container } = render(<YouTubeFacade {...props} onPlay={onPlay} />);
    act(() => fireEvent.click(screen.getByRole("button", { name: props.playLabel })));
    expect(container.querySelector("iframe")?.getAttribute("src")).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/abc123\?autoplay=1/,
    );
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
