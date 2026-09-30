const morgan = require("morgan");

function safeRequestUrl(request) {
  return (request.originalUrl || request.url || "/").split("?")[0];
}

morgan.token("url", safeRequestUrl);
module.exports = { safeRequestUrl };
