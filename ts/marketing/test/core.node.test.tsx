import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  JsonLd,
  accented,
  charLength,
  contactChannel,
  firstFieldErrors,
  fromSafeParse,
  localBusiness,
  telHref,
  translateErrors,
  whatsappHref,
} from "../src/index";

describe("accented", () => {
  it("returns a flat list: strings stay strings, <br>s stay siblings", () => {
    const nodes = accented({ text: "Fix it *today*.\nCall us", className: "a" });
    expect(nodes.filter(n => typeof n === "string")).toEqual(["Fix it ", ".", "Call us"]);
    const elements = nodes.filter(isValidElement);
    expect(elements.map(e => e.type)).toEqual(["span", "br"]);
    expect(renderToStaticMarkup(<>{nodes}</>)).toBe(
      'Fix it <span class="a">today</span>.<br/>Call us',
    );
  });

  it("keeps an unpaired * literal instead of accenting the rest", () => {
    const html = (text: string) =>
      renderToStaticMarkup(<>{accented({ text, className: "a" })}</>);
    // Pairs left to right; only the last, unpaired `*` stays text.
    expect(html("The *best* plumber, 5* rated")).toBe(
      'The <span class="a">best</span> plumber, 5* rated',
    );
    expect(html("Rated 5*")).toBe("Rated 5*");
  });

  it("splits a line break inside an accent into sibling spans around a <br>", () => {
    const nodes = accented({ text: "Call *right\nnow*", className: "a" });
    expect(nodes.filter(isValidElement).map(e => e.type)).toEqual(["span", "br", "span"]);
    expect(renderToStaticMarkup(<>{nodes}</>)).toBe(
      'Call <span class="a">right</span><br/><span class="a">now</span>',
    );
  });

  it("cycles tones when the translation carries more accents", () => {
    const html = renderToStaticMarkup(
      <>{accented({ text: "*a* *b* *c*", classNames: ["x", "y"] })}</>,
    );
    expect(html).toBe('<span class="x">a</span> <span class="y">b</span> <span class="x">c</span>');
  });
});

describe("validation", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(charLength("🔧ok")).toBe(3);
  });

  it("keeps the first key per field and drops path-less issues", () => {
    expect(
      firstFieldErrors([
        { path: ["email"], message: "validation.email.invalid" },
        { path: ["email"], message: "validation.email.max" },
        { path: [], message: "validation.form" },
        { path: ["name", 0], message: "validation.name.min" },
      ]),
    ).toEqual({ email: "validation.email.invalid", name: "validation.name.min" });
  });

  it("handles fields named like Object.prototype members", () => {
    const errors = firstFieldErrors([
      { path: ["constructor"], message: "validation.a" },
      { path: ["toString"], message: "validation.b" },
      { path: ["__proto__"], message: "validation.c" },
    ]);
    expect(Object.hasOwn(errors, "constructor")).toBe(true);
    expect(Object.keys(errors)).toEqual(["constructor", "toString", "__proto__"]);
    expect(Object.getPrototypeOf(errors)).toBe(Object.prototype);
    expect(translateErrors(errors, k => k.toUpperCase())).toEqual(
      Object.fromEntries([
        ["constructor", "VALIDATION.A"],
        ["toString", "VALIDATION.B"],
        ["__proto__", "VALIDATION.C"],
      ]),
    );
  });

  it("adapts a safeParse result either way", () => {
    expect(fromSafeParse({ success: true, data: { a: "1" } })).toEqual({ data: { a: "1" } });
    expect(
      fromSafeParse<{ a: string }>({
        success: false,
        error: { issues: [{ path: ["a"], message: "validation.a" }] },
      }),
    ).toEqual({ errors: { a: "validation.a" } });
  });

  it("translates keys only at the edge", () => {
    expect(translateErrors({ a: "k.a" }, k => k.toUpperCase())).toEqual({ a: "K.A" });
  });
});

describe("contact links", () => {
  it.each([
    ["tel:+33 1 23", "phone"],
    ["TEL:+331", "phone"],
    ["mailto:a@b.c", "email"],
    ["https://wa.me/33612345678", "whatsapp"],
    ["https://api.whatsapp.com/send?phone=336", "whatsapp"],
    ["https://web.whatsapp.com/send?phone=336", "whatsapp"],
    ["whatsapp://send?phone=336", "whatsapp"],
    ["https://wa.me.evil.com/336", null],
    ["https://example.com/tel:+331", null],
    ["/contact", null],
    ["", null],
  ] as const)("classifies %s as %s", (href, channel) => {
    expect(contactChannel(href)).toBe(channel);
  });

  it("builds dialable hrefs from formatted numbers", () => {
    expect(telHref("+33 (0)1 23-45.67 89")).toBe("tel:+33123456789");
    expect(whatsappHref("+33 6 12 34 56 78", "Bonjour, fuite ?")).toBe(
      "https://wa.me/33612345678?text=Bonjour%2C%20fuite%20%3F",
    );
    expect(whatsappHref("0033 6 12 34 56 78")).toBe("https://wa.me/33612345678");
  });
});

describe("JSON-LD", () => {
  it("builds a compact LocalBusiness with nested address and geo", () => {
    expect(
      localBusiness(
        {
          id: "https://brand.example/#paris",
          type: "Plumber",
          name: "Brand — Paris",
          telephone: undefined,
          address: { streetAddress: "1 rue X", addressLocality: "Paris", addressCountry: "FR" },
          geo: { lat: 48.85, lng: 2.35 },
          sameAs: [],
        },
        { priceRange: "€€" },
      ),
    ).toEqual({
      "@type": "Plumber",
      "@id": "https://brand.example/#paris",
      name: "Brand — Paris",
      address: {
        "@type": "PostalAddress",
        streetAddress: "1 rue X",
        addressLocality: "Paris",
        addressCountry: "FR",
      },
      geo: { "@type": "GeoCoordinates", latitude: 48.85, longitude: 2.35 },
      priceRange: "€€",
    });
  });

  it("cannot be broken out of its <script>", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: "</script><script>x()" }} />);
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script>");
  });
});
