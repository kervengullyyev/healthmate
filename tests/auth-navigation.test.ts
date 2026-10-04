import { expect, it } from "vitest";
import { safeReturnTo } from "../src/lib/auth-navigation";
it.each(["https://other.example", "//other.example", "/\\other.example", "/api/auth/signout", "/not-a-page", undefined])("does not allow unsafe or unrelated login redirects: %s", (value) => {
  expect(safeReturnTo(value)).toBe("/");
});
it("returns the user to the requested appointment page after login", () => {
  expect(safeReturnTo("/appointments/new?from=milo")).toBe("/appointments/new?from=milo");
});
