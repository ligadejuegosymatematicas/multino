import assert from "node:assert/strict";
import test from "node:test";

import { createDomino, isDouble } from "../src/js/game/model/Domino.js";

test("una definición de ficha conserva dos lados identificables", () => {
  const domino = createDomino({ id: "example", values: [5, 5] });

  assert.deepEqual(domino, {
    id: "example",
    sides: [
      { id: "a", value: 5 },
      { id: "b", value: 5 },
    ],
  });
  assert.equal(isDouble(domino), true);
});

test("el modelo no acepta una ficha con una cantidad distinta de dos lados", () => {
  assert.throws(
    () => createDomino({ id: "invalid", values: [1] }),
    /exactamente dos lados/,
  );
});
