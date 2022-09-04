const http = require("http");
const https = require("https");

module.exports = function fetch(url) {
  return new Promise((resolve, reject) => {
    const data = [];
    const client = url.startsWith("https") ? https : http;
    client
      .request(url, (res) => {
        res.on(`data`, (chunk) => data.push(chunk));
        res.on(`end`, () => {
          const asBytes = Buffer.concat(data);
          const asString = asBytes.toString(`utf8`);
          resolve({
            arrayBuffer: async () => asBytes,
            json: async () => JSON.parse(asString),
            text: async () => asString,
          });
        });
        res.on(`error`, (e) => reject(e));
      })
      .end();
  });
};
