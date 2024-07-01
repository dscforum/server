const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { query, validationResult, matchedData, body } = require('express-validator');
const { ClerkExpressRequireAuth, clerkClient } = require('@clerk/clerk-sdk-node');
const bodyParser = require('body-parser');

module.exports = {
  get: [
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    query('category')
      .isIn(['announcements', 'updates', 'discussions']).withMessage('Invalid category. It should be one of \'announcements\', \'updates\', or \'discussions\'.'),
    query('page')
      .isInt({ min: 1 }).withMessage('Page should be an integer greater than or equal to 1.'),
    async (request, response) => {
      const errors = validationResult(request);
      if (!errors.isEmpty()) return response.status(400).json({ errors: errors.array()[0].msg });

      const { category, page } = matchedData(request);

      const perPage = 5;
      const skip = (page - 1) * perPage;

      // Fetch entries based on the category and soetrt them by the pinned status and creation date
      const entries = await Entry.find({ category }).sort({ 'flags.isPinned': -1, publishedAt: -1 }).skip(skip).limit(perPage);

      const parsedEntries = (
        await Promise.all(entries.map(async entry => {
          // If the user is already fetched, return the cached user
          if (request.app.locals.cachedClerkUsers.has(entry.publisherId) && request.app.locals.cachedClerkUsers.get(entry.publisherId).expiresAt > Date.now()) {
            return {
              ...entry.toObject(),
              publisherMetadata: request.app.locals.cachedClerkUsers.get(entry.publisherId)
            };
          }

          const publisher = await clerkClient.users.getUser(entry.publisherId).catch(() => null);
          if (!publisher) return null;
          
          // Cache the fetched user for 5 minutes
          request.app.locals.cachedClerkUsers.set(entry.publisherId, {
            username: publisher.username,
            avatar: publisher.imageUrl,
            expiresAt: Date.now() + 1000 * 60 * 5
          });

          return {
            ...entry.toObject(),
            publisherMetadata: {
              username: publisher.username,
              avatar: publisher.imageUrl,
              isAdmin: publisher.publicMetadata.role === 'admin'
            }
          };
        }))
      ).filter(Boolean);

      return response.json(parsedEntries);
    }
  ],
  post: [
    ClerkExpressRequireAuth(),
    useRateLimiter({ maxRequests: 5, perMinutes: 1 }),
    bodyParser.json(),
    body('title')
      .isString().withMessage('Title should be a string.')
      .isLength({ min: 1, max: 100 }).withMessage('Title should be between 1 and 100 characters.'),
    body('category')
      .isIn(['announcements', 'updates', 'discussions']).withMessage('Invalid category. It should be one of \'announcements\', \'updates\', or \'discussions\'.'),
    body('content')
      .isString().withMessage('Content should be a string.')
      .isLength({ min: 1, max: 1024 }).withMessage('Content should be between 1 and 1024 characters.'),
    async (request, response) => {
      const errors = validationResult(request);
      if (!errors.isEmpty()) return response.status(400).json({ errors: errors.array()[0].msg });

      const userId = request.auth.userId;
      const user = await clerkClient.users.getUser(userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });

      const adminProtectedCategories = ['announcements'];
      if (adminProtectedCategories.includes(request.body.category) && !user.publicMetadata.role === 'admin') return response.status(403).json({ error: 'You are not authorized to create an entry in this category.' });

      const { title, category, content } = matchedData(request);

      const entry = new Entry({
        title,
        category,
        content,
        publisherId: request.auth.userId
      });

      await entry.save();

      return response.status(201).json(entry);
    }
  ]
};