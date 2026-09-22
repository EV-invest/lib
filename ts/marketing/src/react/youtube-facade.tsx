import { useState } from "react";
import { cn } from "@evinvest/uikit";

import { ClickToLoad } from "./click-to-load";

export interface YouTubeFacadeProps {
  videoId: string;
  /** Accessible title of the player and alt of the poster. */
  title: string;
  /** Accessible name of the play control — translated by the caller. */
  playLabel: string;
  /** Own poster URL; otherwise YouTube's generated stills. */
  poster?: string;
  onPlay?: () => void;
  className?: string;
}

/**
 * Posters to try, in order. `maxresdefault` only exists when the upload was
 * at least 1280x720 and 404s otherwise, so `hqdefault` — which YouTube
 * generates for every video — backs it. A caller's own poster is used alone.
 */
function posterCandidates(videoId: string, poster?: string): string[] {
  if (poster) return [poster];
  return ["maxresdefault", "hqdefault"].map(
    name => `https://i.ytimg.com/vi/${videoId}/${name}.jpg`,
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

/**
 * A YouTube video behind {@link ClickToLoad}: poster and play button until
 * pressed, then the `youtube-nocookie.com` player (the privacy-preserving
 * host), autoplaying so the press is not needed twice.
 */
export function YouTubeFacade({
  videoId,
  title,
  playLabel,
  poster,
  onPlay,
  className,
}: YouTubeFacadeProps) {
  // Past the last candidate `src` is undefined, which renders the flat field
  // and — importantly — stops firing onError. Advancing an index rather than
  // flipping a boolean is what keeps a failing src from re-erroring forever.
  const [attempt, setAttempt] = useState(0);
  const src = posterCandidates(videoId, poster)[attempt];

  return (
    <ClickToLoad
      className={cn("relative aspect-video overflow-hidden bg-secondary", className)}
      {...(onPlay ? { onLoad: onPlay } : {})}
      placeholder={load => (
        <>
          {src ? (
            <img
              src={src}
              alt={title}
              loading="lazy"
              decoding="async"
              onError={() => setAttempt(n => n + 1)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={load}
            aria-label={playLabel}
            className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-transform motion-safe:hover:scale-105"
          >
            <PlayGlyph />
          </button>
        </>
      )}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 size-full border-0"
      />
    </ClickToLoad>
  );
}
