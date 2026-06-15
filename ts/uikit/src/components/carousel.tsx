import * as React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { useControllableState } from "../primitives/use-controllable-state";

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
    <div className="overflow-hidden" data-slot="carousel-content">
      <div
        className={cn(
          "flex transition-transform",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
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
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
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
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 -left-12 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
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
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 -right-12 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
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
