const mongoose = require('mongoose');

function connectDatabase(url) {
  mongoose.connect(url, { dbName: 'dscforum' }) 
    .then(() => logger.database('Connected to database.'));
}

module.exports = connectDatabase;