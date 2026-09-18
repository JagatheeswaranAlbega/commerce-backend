import { describe, expect, it } from "vitest";
import {
  assertOrderCanRequestReturn,
  assertReturnIsRequested,
} from "./returns";
import { InvalidStateError } from "@/shared/errors/app-error";

describe("return state helpers", () => {
  it("allows return requests only for delivered orders", () => {
    expect(() => assertOrderCanRequestReturn("DELIVERED")).not.toThrow();
    expect(() => assertOrderCanRequestReturn("SHIPPED")).toThrow(InvalidStateError);
    expect(() => assertOrderCanRequestReturn("PENDING")).toThrow(InvalidStateError);
  });

  it("allows decisions only while return is requested", () => {
    expect(() => assertReturnIsRequested("REQUESTED")).not.toThrow();
    expect(() => assertReturnIsRequested("APPROVED")).toThrow(InvalidStateError);
    expect(() => assertReturnIsRequested("REJECTED")).toThrow(InvalidStateError);
  });
});
