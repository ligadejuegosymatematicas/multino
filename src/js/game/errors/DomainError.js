export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function domainAssert(condition, code, message, details = {}) {
  if (!condition) {
    throw new DomainError(code, message, details);
  }
}

