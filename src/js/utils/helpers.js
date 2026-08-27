export function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertNonEmptyId(id, label = "id") {
  if (typeof id !== "string" || id.trim() === "") {
    throw new TypeError(`${label} debe ser una cadena no vacía.`);
  }

  return id;
}

