/**
 * End-to-end usage of the kernel from a consumer's point of view, modelling a
 * tiny "blog" bounded context — the TS counterpart of `tests/architecture.rs`.
 */
import { describe, expect, it } from "vitest";

import { Id } from "../src/identifier";
import { spec } from "../src/specification";
import type { AggregateRoot, Entity } from "../src/entity";
import type { Gateway } from "../src/gateway";
import type { Reader, Repository } from "../src/repository";
import type { UnitOfWork } from "../src/unit-of-work";

type BlogId = Id<"blog">;

interface Blog extends AggregateRoot<BlogId> {
  readonly published: boolean;
  readonly words: number;
}

function makeBlog(args: { id: BlogId; published: boolean; words: number }): Blog {
  return { name: "blog", ...args };
}

// --- Specifications: a reusable rule and a composed one ---------------------

describe("specifications compose", () => {
  it("matches the Rust integration expectations", () => {
    const published = (b: Blog) => b.published;
    const long = (b: Blog) => b.words >= 1_000;
    const featured = spec(published).and(long);

    const a = makeBlog({ id: Id.newUuid<"blog">(), published: true, words: 2_000 });
    const b = makeBlog({ id: Id.newUuid<"blog">(), published: false, words: 2_000 });
    const c = makeBlog({ id: Id.newUuid<"blog">(), published: true, words: 10 });

    expect(featured.holds(a)).toBe(true);
    expect(featured.holds(b)).toBe(false);
    expect(featured.holds(c)).toBe(false);
    expect(spec(published).not().holds(b)).toBe(true);
  });
});

// --- Repository / Reader ports on a concrete adapter ------------------------

interface BlogRepository extends Repository<Blog>, Reader<Blog> {
  create(blog: Blog): void;
  find(id: BlogId): Blog | undefined; // Rust Option<Blog> → T | undefined
}

class InMemoryBlogs implements BlogRepository {
  private readonly rows: Blog[] = [];

  create(blog: Blog): void {
    this.rows.push(blog);
  }

  find(id: BlogId): Blog | undefined {
    return this.rows.find((b) => b.id === id);
  }
}

describe("repository round-trips and stays a usable port type", () => {
  it("finds what it stored and reports a miss as undefined", () => {
    const repo: BlogRepository = new InMemoryBlogs();
    const id = Id.newUuid<"blog">();
    repo.create(makeBlog({ id, published: true, words: 1 }));

    expect(repo.find(id)).toBeDefined();
    expect(repo.find(Id.newUuid<"blog">())).toBeUndefined();

    const found = repo.find(id);
    expect(found?.name).toBe("blog");
  });

  it("an entity is identified by its id", () => {
    const id = Id.newUuid<"blog">();
    const entity: Entity<BlogId> = makeBlog({ id, published: false, words: 0 });
    expect(entity.id).toBe(id);
  });
});

// --- Gateway marker on an external system -----------------------------------

class FakeLedger implements Gateway {
  transfer(_from: bigint, _to: bigint, _amount: bigint): void {}
}

describe("gateway is a marker", () => {
  it("a concrete adapter satisfies the marker interface", () => {
    const ledger: Gateway = new FakeLedger();
    expect(ledger).toBeInstanceOf(FakeLedger);
  });
});

// --- UnitOfWork: terminal commit / rollback ---------------------------------

class SpyTx implements UnitOfWork {
  state: "untouched" | "committed" | "rolled-back" = "untouched";

  async commit(): Promise<void> {
    this.state = "committed";
  }

  async rollback(): Promise<void> {
    this.state = "rolled-back";
  }
}

describe("unit of work", () => {
  it("commit runs to completion", async () => {
    const tx = new SpyTx();
    const uow: UnitOfWork = tx;
    await uow.commit();
    expect(tx.state).toBe("committed");
  });

  it("rollback runs to completion", async () => {
    const tx = new SpyTx();
    const uow: UnitOfWork = tx;
    await uow.rollback();
    expect(tx.state).toBe("rolled-back");
  });

  it("a failing transaction rejects rather than returning an error value", async () => {
    const failing: UnitOfWork = {
      commit: () => Promise.reject(new Error("deadlock")),
      rollback: () => Promise.resolve(),
    };
    await expect(failing.commit()).rejects.toThrow("deadlock");
  });
});
