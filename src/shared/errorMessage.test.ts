import { describe, it, expect } from "vitest";
import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("reads the message off an Error", () => {
    expect(errorMessage(new Error("quota exceeded"))).toBe("quota exceeded");
  });

  it("uses a thrown string as the message, rather than showing undefined", () => {
    expect(errorMessage("plain failure")).toBe("plain failure");
  });

  it("has something to say for anything else", () => {
    expect(errorMessage(null)).toBe("Unknown error");
    expect(errorMessage(undefined)).toBe("Unknown error");
    expect(errorMessage({ code: 500 })).toBe("[object Object]");
  });
});
