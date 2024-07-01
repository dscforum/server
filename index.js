const connectDatabase = require('@/scripts/connectDatabase');
connectDatabase(process.env.MONGODB_URI);

const createServer = require('@/lib/express/createServer');
createServer();