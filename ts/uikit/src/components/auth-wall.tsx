import * as React from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

/**
 * What a section shows a caller it is not for: an `Empty` with a lock, a title, why,
 * and an action slot. A guest gets the sign-in button there; a signed-in caller
 * without the permission gets no action, or the host's own (request access).
 */
export interface AuthWallProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  description: React.ReactNode;
}

export function AuthWall({ title, description, children, ...props }: AuthWallProps) {
  return (
    <Empty {...props}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  );
}

// lucide `lock`, inlined so the kit keeps its zero-icon-dep footprint.
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
