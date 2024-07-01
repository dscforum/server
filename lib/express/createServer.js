const express = require('express');
const compression = require('compression');
const path = require('node:path');
const { router } = require('express-file-routing');
const morganMiddleware = require('@/lib/express/middlewares/morganMiddleware');
const cors = require('cors');

async function createServer() {
  const app = express();

  // Configure the server
  app.set('trust proxy', 1);
  app.set('x-powered-by', false);
  app.set('etag', false);

  // Add middlewares
  app.use(morganMiddleware);
  app.use(compression());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [config.frontend_url] : 'http://localhost:' + config.client.port,
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    optionsSuccessStatus: 200,
    credentials: true
  }));

  // Add caching variables
  app.locals.cachedClerkUsers = new Map();

  // Configure express-file-routing
  app.use('/', await router({ directory: path.join(__dirname, 'routes') }));

  app.use((request, response) => response.status(404).json({ error: 'Resource not found.' }));

  app.listen(config.server.port, () => {
    logger.http(`Server is listening on port ${config.server.port}.`);
  });
}

module.exports = createServer;