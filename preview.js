const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  console.log('Starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  process.env.MONGODB_URI = uri;
  process.env.PORT = '3000';
  
  console.log(`In-memory MongoDB started at ${uri}`);
  console.log('Starting app server...');
  
  require('./server.js');
})();
