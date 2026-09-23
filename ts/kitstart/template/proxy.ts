import { createProxy } from "@evinvest/kitstart/proxy";
import { site } from "@/shared/config/site";

export const proxy = createProxy(site);

export const config = {
  // A literal: Next reads it statically. Everything but the build output and
  // files with an extension; `/quote`, `/og` and `/health` enter and pass.
  matcher: ["/((?!_next/|.*\\.[a-z0-9]+$).*)"],
};
