import { expect, it } from "vitest";
import {
  canAddExchange,
  withinInterviewBudget,
} from "../src/lib/conversation-budget";
import type { Message } from "../src/lib/domain";
const message = (i: number, content = "Patient detail"): Message => ({
  id: String(i),
  role: "user",
  content,
});
it("reserves plan correction capacity before another exchange starts", () => {
  const history = Array.from({ length: 29 }, (_, i) => message(i));
  expect(canAddExchange(history, "One more detail")).toBe(false);
  expect(history).toHaveLength(29);
  expect(29 + 1 + Math.ceil(10000 / 1800)).toBeLessThanOrEqual(40);
});
it("accounts for UTF-8 and JSON escapes before the server body limit", () => {
  const history = Array.from({ length: 12 }, (_, i) =>
    message(i, "界".repeat(1000)),
  );
  expect(withinInterviewBudget(history)).toBe(false);
  expect(canAddExchange(history, "A correction")).toBe(false);
  expect(canAddExchange([message(1, "A short concern")], "Details")).toBe(true);
});
