"use strict";

// Message is safe to show to the user verbatim.
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}

module.exports = { UserError };
