const { loadConfig } = require("./config");
const { createServer } = require("./server");

function start() {
  const config = loadConfig();
  const server = createServer(config);

  server.listen(config.port, () => {
    console.log(`Listening on port ${config.port}`);
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = {
  start
};
