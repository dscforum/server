const useRateLimiter = require('@/utils/useRateLimiter');
const Entry = require('@/models/Entry');
const { clerkClient } = require('@clerk/clerk-sdk-node');

module.exports = {
  get: [
    useRateLimiter({ maxRequests: 20, perMinutes: 1 }),
    async (request, response) => {
      // Get the top 5 entries based on the reply count
      const topEntries = await Entry.find().sort({ replyCount: -1 }).limit(5);

      const parsedEntries = (
        await Promise.all(topEntries.map(async entry => {
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
              avatar: publisher.imageUrl
            }
          };
        }))
      ).filter(Boolean);

      return response.json(parsedEntries);
    }
  ]
};