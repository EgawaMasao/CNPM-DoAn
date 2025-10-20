const mongoose = require('mongoose');

let MongoMemoryServer; // will be required lazily only if needed
let mongoServer;

/**
 * Increase Jest timeout for slow operations (downloads, DB startup).
 */
if (typeof jest !== 'undefined' && typeof jest.setTimeout === 'function') {
  jest.setTimeout(30000);
}

beforeAll(async () => {
  const connectOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim() !== '') {
    console.log('[setupMongo] Connecting to external MongoDB at', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, connectOpts);
  } else {
    console.log('[setupMongo] No MONGODB_URI — lazily starting mongodb-memory-server');
    // Lazy-require so import time doesn't trigger binary download when MONGODB_URI exists
    const mms = require('mongodb-memory-server');
    MongoMemoryServer = mms.MongoMemoryServer || mms.default?.MongoMemoryServer || mms;
    mongoServer = await MongoMemoryServer.create();
    // expose for backwards compatibility if tests reference global.mongoServer
    global.mongoServer = mongoServer;
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, connectOpts);
  }
});

afterEach(async () => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const collections = Object.keys(mongoose.connection.collections);
  for (const name of collections) {
    try {
      await mongoose.connection.collections[name].deleteMany({});
    } catch (err) {
      // ignore errors for dropped collections
    }
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
  if (mongoServer) {
    try {
      await mongoServer.stop();
    } catch (e) {
      // ignore
    }
  }
});