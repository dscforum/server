const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { matchedData, param, validationResult } = require('express-validator');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const bodyParser = require('body-parser');

module.exports = {
  delete: [
    ClerkExpressRequireAuth(),
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    bodyParser.json(),
    param('id')
      .isMongoId().withMessage('Invalid entry ID.'),
    param('reply_id')
      .isMongoId().withMessage('Invalid reply ID.'),
    async (request, response) => {
      const errors = validationResult(request);
      if (!errors.isEmpty()) return response.status(400).json({ errors: errors.array()[0].msg });

      const { id, reply_id } = matchedData(request);

      const entry = await Entry.findById(id);
      if (!entry) return response.status(404).json({ error: 'Entry not found.' });

      if (!entry.replies.some(reply => reply._id.equals(reply_id))) return response.status(404).json({ error: 'Reply not found.' });
      
      const userId = request.auth.userId;
      const user = await clerkClient.users.getUser(userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });

      const reply = entry.replies.find(reply => reply._id.equals(reply_id));
      if (reply.publisherId !== userId && user.publicMetadata.role !==  'admin') return response.status(403).json({ error: 'You do not have permission to delete this reply.' });

      await entry.updateOne({
        $pull: {
          replies: {
            _id: reply_id
          }
        },
        $inc: {
          replyCount: -1
        }
      });

      return response.sendStatus(204).end();
    }
  ]
};