import * as React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { useControllableState } from "../primitives/use-controllable-state";
import {
  CAROUSEL_CONTENT_TRACK,
  CAROUSEL_CONTENT_TRACK_HORIZONTAL,
  CAROUSEL_CONTENT_TRACK_VERTICAL,
  CAROUSEL_CONTENT_VIEWPORT,
  CAROUSEL_EDGE_FADE_NEXT,
  CAROUSEL_EDGE_FADE_PREV,
  CAROUSEL_ITEM,
  CAROUSEL_ITEM_HORIZONTAL,
  CAROUSEL_ITEM_VERTICAL,
  CAROUSEL_NAV,
  CAROUSEL_NEXT_HORIZONTAL,
  CAROUSEL_NEXT_VERTICAL,
  CAROUSEL_PREVIOUS_HORIZONTAL,
  CAROUSEL_PREVIOUS_VERTICAL,
} from "../generated/carousel";

type CarouselOrientation = "horizontal" | "vertical";

type CarouselContextProps = {
  orientation: CarouselOrientation;
  index: number;
  count: number;
  setCount: (count: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
};

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }
  return context;
}

export interface CarouselProps extends React.ComponentProps<"div"> {
  orientation?: CarouselOrientation;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function Carousel({
  orientation = "horizontal",
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  className,
  children,
  onKeyDown,
  ...props
}: CarouselProps) {
  const [index, setIndex] = useControllableState<number>({
    value: indexProp,
    defaultValue: defaultIndex,
    onChange: onIndexChange,
  });
  const [count, setCount] = React.useState(0);

  const canScrollPrev = index > 0;
  const canScrollNext = index < count - 1;

  const scrollPrev = React.useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index, setIndex]);

  const scrollNext = React.useCallback(() => {
    if (index < count - 1) setIndex(index + 1);
  }, [index, count, setIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollNext();
    }
    onKeyDown?.(event);
  };

  return (
    <CarouselContext.Provider
      value={{
        orientation,
        index,
        count,
        setCount,
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        tabIndex={0}
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { orientation, index, setCount } = useCarousel();
  const childCount = React.Children.count(children);

  React.useEffect(() => {
    setCount(childCount);
  }, [childCount, setCount]);

  // drag/momentum: omitted vs embla — see README Limitations
  const transform =
    orientation === "horizontal"
      ? `translate3d(-${index * 100}%, 0, 0)`
      : `translate3d(0, -${index * 100}%, 0)`;

  return (
    <div className={CAROUSEL_CONTENT_VIEWPORT} data-slot="carousel-content">
      <div
        className={cn(
          CAROUSEL_CONTENT_TRACK,
          orientation === "horizontal"
            ? CAROUSEL_CONTENT_TRACK_HORIZONTAL
            : CAROUSEL_CONTENT_TRACK_VERTICAL,
          className,
        )}
        style={{ transform }}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function CarouselItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { orientation } = useCarousel();

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        CAROUSEL_ITEM,
        orientation === "horizontal" ? CAROUSEL_ITEM_HORIZONTAL : CAROUSEL_ITEM_VERTICAL,
        className,
      )}
      {...props}
    />
  );
}

/**
 * Netflix-style edge scrims that dissolve the current slide into the surface
 * colour, signalling adjacent slides without revealing them. Each side shows
 * only when there is somewhere to scroll. Drop inside a <Carousel>.
 */
export function CarouselEdgeFade({
  className,
}: {
  className?: string;
}) {
  const { canScrollPrev, canScrollNext } = useCarousel();

  return (
    <>
      <div
        aria-hidden
        className={cn(
          CAROUSEL_EDGE_FADE_PREV,
          canScrollPrev ? "opacity-100" : "opacity-0",
          className,
        )}
      />
      <div
        aria-hidden
        className={cn(
          CAROUSEL_EDGE_FADE_NEXT,
          canScrollNext ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </>
  );
}

export function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ButtonProps) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        CAROUSEL_NAV,
        orientation === "horizontal"
          ? CAROUSEL_PREVIOUS_HORIZONTAL
          : CAROUSEL_PREVIOUS_VERTICAL,
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="sr-only">Previous slide</span>
    </Button>
  );
}

export function CarouselNext({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ButtonProps) {
  const { orientation, scrollNext, canScrollNext } = useCarousel();

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        CAROUSEL_NAV,
        orientation === "horizontal"
          ? CAROUSEL_NEXT_HORIZONTAL
          : CAROUSEL_NEXT_VERTICAL,
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      <span className="sr-only">Next slide</span>
    </Button>
  );
}
