import assert from "node:assert/strict";

export function assertThrowsDomainCode(callback, expectedCode) {
  assert.throws(
    callback,
    (error) => error?.name === "DomainError" && error.code === expectedCode,
  );
}

