const { isValidSession } = require('./lib/session');

exports.handler = async (event) => {
  const valid = isValidSession(event.headers.cookie);
  return {
    statusCode: valid ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticated: valid })
  };
};
