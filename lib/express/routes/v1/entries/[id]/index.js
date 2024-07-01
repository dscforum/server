const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { matchedData, param } = require('express-validator');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

module.exports = {
  get: [
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    param('id')
      .isMongoId().withMessage('Invalid entry ID.'),
    async (request, response) => {
      const { id } = matchedData(request);

      const entry = await Entry.findById(id);
      if (!entry) return response.status(404).json({ error: 'Entry not found.' });

      const entryReplies = [];

      // Fetch the metadata of each reply
      for (const reply of entry.replies.sort((a, b) => a.publishedAt - b.publishedAt)) {
        // If the user is already fetched, return the cached user
        const cachedReplyPublisher = request.app.locals.cachedClerkUsers.get(reply.publisherId);
        if (cachedReplyPublisher && cachedReplyPublisher.expiresAt > Date.now()) {
          entryReplies.push({ ...reply.toObject(), publisherMetadata: cachedReplyPublisher });
          continue;
        }

        const replyPublisher = await clerkClient.users.getUser(reply.publisherId).catch(() => null);
        if (!replyPublisher) continue;

        // Cache the fetched user for 5 minutes
        request.app.locals.cachedClerkUsers.set(reply.publisherId, {
          username: replyPublisher.username,
          avatar: replyPublisher.imageUrl,
          isAdmin: replyPublisher.publicMetadata.role === 'admin',
          expiresAt: Date.now() + 1000 * 60 * 5
        });

        entryReplies.push({
          ...reply.toObject(),
          publisherMetadata: {
            username: replyPublisher.username,
            avatar: replyPublisher.imageUrl,
            isAdmin: replyPublisher.publicMetadata.role === 'admin'
          }
        });
      }

      // If the user is already fetched, return the cached user
      const cachedPublisher = request.app.locals.cachedClerkUsers.get(entry.publisherId);
      if (cachedPublisher && cachedPublisher.expiresAt > Date.now()) {
        return response.json({
          ...entry.toObject(),
          publisherMetadata: cachedPublisher,
          replies: entryReplies
        });
      }

      const publisher = await clerkClient.users.getUser(entry.publisherId).catch(() => null);
      if (!publisher) return response.status(404).json({ error: 'Publisher not found.' });

      // Cache the fetched user for 5 minutes
      request.app.locals.cachedClerkUsers.set(entry.publisherId, {
        username: publisher.username,
        avatar: publisher.imageUrl,
        isAdmin: publisher.publicMetadata.role === 'admin',
        expiresAt: Date.now() + 1000 * 60 * 5
      }); 

      return response.json({
        ...entry.toObject(),
        publisherMetadata: {
          username: publisher.username,
          avatar: publisher.imageUrl,
          isAdmin: publisher.publicMetadata.role === 'admin'
        },
        replies: entryReplies
      });
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

      // check role and publisher status
      const user = await clerkClient.users.getUser(request.auth.userId).catch(() => null);
      if (!user) return response.status(401).json({ error: 'Clerk user not found.' });

      if (user.id !== entry.publisherId && user.publicMetadata.role !== 'admin') return response.status(403).json({ error: 'You do not have permission to delete this entry.' });

      await entry.deleteOne();

      return response.sendStatus(204).end();
    }
  ]
};