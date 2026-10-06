const morgan = require("morgan");

function safeRequestUrl(request) {
  return (request.originalUrl || request.url || "/").split("?")[0];
}

morgan.token("url", safeRequestUrl);
// Structured request events are emitted by the root server middleware.
morgan.format("tiny", () => undefined);
module.exports = { safeRequestUrl };
