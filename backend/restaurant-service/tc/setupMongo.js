const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Increase Jest timeout for slow operations (downloads, DB startup).
 * You can tweak this value if needed.
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
    console.log('Test setup: connecting to external MongoDB at', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, connectOpts);
  } else {
    console.log('Test setup: no MONGODB_URI provided — starting mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    // Expose to tests that may reference mongoServer (for backwards compatibility)
    global.mongoServer = mongoServer;
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, connectOpts);
  }
});

// Clean database between tests (safe generic cleanup)
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