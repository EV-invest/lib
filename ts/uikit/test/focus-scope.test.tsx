import { describe, it, expect } from "vitest";
import { focusCandidates } from "../src/primitives/focus-scope";

describe("focusCandidates", () => {
  it("lists enabled controls in DOM order and skips tabindex=-1 on any tag", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<a href="#" id="link">a</a>',
      '<a href="#" tabindex="-1">parked link</a>',
      '<button id="btn">b</button>',
      '<button tabindex="-1">parked button</button>',
      "<button disabled>disabled</button>",
      '<input id="input">',
      '<input tabindex="-1">',
      '<div tabindex="0" id="div">d</div>',
      '<div tabindex="-1">parked div</div>',
      "<span>text</span>",
    ].join("");
    document.body.appendChild(root);
    try {
      expect(focusCandidates(root).map(el => el.id)).toEqual(["link", "btn", "input", "div"]);
    } finally {
      root.remove();
    }
  });
});
