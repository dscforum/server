const { rateLimit } = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

module.exports = function ({ maxRequests, perMinutes }) {
  const limiter = rateLimit({
    windowMs: perMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
      status: 429
    },
    store: new MongoStore({
      uri: process.env.MONGODB_URI,
      expireTimeMs: perMinutes * 60 * 1000,
      errorHandler: logger.error.bind(null, '[Rate Limit Mongo Error]')
    }),
    skipFailedRequests: true,
    skip: request => {
      if (process.env.NODE_ENV === 'development') return true;
      if (request.method === 'OPTIONS') return true;
    }
  });

  return limiter;
};