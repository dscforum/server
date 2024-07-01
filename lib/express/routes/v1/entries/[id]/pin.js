const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { matchedData, param } = require('express-validator');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

module.exports = {
  put: [
    ClerkExpressRequireAuth(),
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    param('id')
      .isMongoId().withMessage('Invalid entry ID.'),
    async (request, response) => {
      const { id } = matchedData(request);

      const entry = await Entry.findById(id);
      if (!entry) return response.status(404).json({ error: 'Entry not found.' });

      // check role
      const user = await clerkClient.users.getUser(request.auth.userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });

      if (user.publicMetadata.role !== 'admin') return response.status(403).json({ error: 'You do not have permission to pin this entry.' });

      if (entry.flags.isPinned) return response.status(400).json({ error: 'This entry is already pinned.' });

      await entry.updateOne({
        flags: {
          isPinned: true
        }
      });

      return response.sendStatus(204).end();
    }
  ],
  delete: [
    ClerkExpressRequireAuth(),
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    param('id')
      .isMongoId().withMessage('Invalid entry ID.'),
    async (request, response) => {
      const { id } = matchedData(request);

      const entry = await Entry.findById(id);
      if (!entry) return response.status(404).json({ error: 'Entry not found.' });

      // check role
      const user = await clerkClient.users.getUser(request.auth.userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });

      if (user.publicMetadata.role !== 'admin') return response.status(403).json({ error: 'You do not have permission to pin this entry.' });

      if (!entry.flags.isPinned) return response.status(400).json({ error: 'This entry is not pinned.' });

      await entry.updateOne({
        flags: {
          isPinned: false
        }
      });

      return response.sendStatus(204).end();
    }
  ]
};