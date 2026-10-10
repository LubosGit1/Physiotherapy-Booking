import { describe, expect, it } from "vitest";
import { homeFor, pageAccess, safeCallbackUrl, type Role } from "@/lib/access";

describe("pageAccess", () => {
  it.each<[string, Role | null, ReturnType<typeof pageAccess>]>([
    ["/", null, "allow"],
    ["/book", null, "allow"],
    ["/book/hold/123", null, "sign-in"],
    ["/book/hold/123", "CLIENT", "allow"],
    ["/book/hold/123", "ADMIN", "forbidden"],
    ["/appointments", "CLIENT", "allow"],
    ["/appointments", "THERAPIST", "forbidden"],
    ["/schedule", "THERAPIST", "allow"],
    ["/schedule", "ADMIN", "forbidden"],
    ["/admin", "ADMIN", "allow"],
    ["/admin", "CLIENT", "forbidden"],
    ["/admin", null, "sign-in"],
    ["/administrator", "CLIENT", "allow"],
  ])("%s as %s → %s", (path, role, expected) => {
    expect(pageAccess(path, role)).toBe(expected);
  });
});

describe("safeCallbackUrl", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackUrl("/book?service=1&date=2030-03-04")).toBe("/book?service=1&date=2030-03-04");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "book", "", null, 42, "/ok\nSet-Cookie: x"])(
    "rejects %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBeNull();
    },
  );
});

it("homeFor sends each role to its own area", () => {
  expect(homeFor("CLIENT")).toBe("/appointments");
  expect(homeFor("THERAPIST")).toBe("/schedule");
  expect(homeFor("ADMIN")).toBe("/admin");
});
