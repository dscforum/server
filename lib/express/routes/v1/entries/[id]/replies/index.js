const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { matchedData, param, body, validationResult } = require('express-validator');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const bodyParser = require('body-parser');

module.exports = {
  post: [
    ClerkExpressRequireAuth(),
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    bodyParser.json(),
    param('id')
      .isMongoId().withMessage('Invalid entry ID.'),
    body('content')
      .isString().withMessage('Content should be a string.')
      .isLength({ min: 1, max: 1024 }).withMessage('Content should be between 1 and 1024 characters long.'),
    async (request, response) => {
      const errors = validationResult(request);
      if (!errors.isEmpty()) return response.status(400).json({ errors: errors.array()[0].msg });

      const { id, content } = matchedData(request);

      const entry = await Entry.findById(id);
      if (!entry) return response.status(404).json({ error: 'Entry not found.' });

      const userId = request.auth.userId;
      const user = await clerkClient.users.getUser(userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });
      
      await entry.updateOne({
        $push: {
          replies: {
            content,
            publisherId: userId
          }
        },
        $inc: {
          replyCount: 1
        }
      });

      return response.sendStatus(204).end();
    }
  ]
};