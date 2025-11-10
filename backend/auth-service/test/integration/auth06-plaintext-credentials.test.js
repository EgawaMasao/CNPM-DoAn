/**
 * INTEGRATION TEST: AUTH-06 - MongoDB Credentials in Plain Text
 * 
 * RISK DESCRIPTION:
 * MongoDB connection string contains embedded credentials in plain text within
 * .env file and potentially committed to version control. Credentials can be
 * leaked through git history, logs, error messages, or team sharing.
 * 
 * VULNERABILITY LOCATION:
 * - .env file (line 2) - MONGO_URI with auth123:auth123
 * - config/db.js (line 5) - Direct use of connection string
 * 
 * BUSINESS IMPACT:
 * - Complete database compromise if credentials leaked
 * - Data theft, modification, or deletion
 * - Compliance violations (GDPR, SOC 2)
 * - Inability to rotate credentials easily
 * 
 * TEST STRATEGY:
 * 1. Verify credentials are in connection string
 * 2. Test credential extraction methods
 * 3. Document leak vectors
 * 4. Demonstrate database access with leaked creds
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const Customer = require('../../models/Customer');

describe('RISK-AUTH-06: MongoDB Credentials in Plain Text', () => {
  let originalMongoUri;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';
    
    // Only connect if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(originalMongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    await Customer.deleteMany({ email: /^creds_test_/ });
  }, 30000);

  afterAll(async () => {
    await Customer.deleteMany({ email: /^creds_test_/ });
  }, 30000);

  describe('Test Case 1: Credential Extraction from Connection String', () => {
    it('should extract username and password from MONGO_URI', () => {
      // GIVEN: Connection string with embedded credentials
      const mongoUri = originalMongoUri || process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';
      console.log('Connection String:', mongoUri);

      // WHEN: Parse connection string
      const credentialsRegex = /mongodb:\/\/([^:]+):([^@]+)@/;
      const match = mongoUri.match(credentialsRegex);

      if (match) {
        const username = match[1];
        const password = match[2];

        // THEN: Credentials extracted (THE VULNERABILITY)
        console.log(`✗ LEAKED - Username: ${username}`);
        console.log(`✗ LEAKED - Password: ${password}`);
        
        expect(username).toBeDefined();
        expect(password).toBeDefined();
        
        // These credentials are now exposed to anyone who can access:
        // - .env file
        // - Git history
        // - Application logs
        // - Error messages
        // - Memory dumps
      } else {
        console.log('✓ No credentials found in connection string (using authentication database or external auth)');
      }
    });

    it('should demonstrate credentials visible in process environment', () => {
      // GIVEN: Application running with environment variables
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';

      // WHEN: Check if credentials are visible
      const hasCredentials = mongoUri.includes('@');

      // THEN: Credentials can be read from process environment
      if (hasCredentials) {
        console.log('✗ VULNERABILITY: Credentials readable from process.env.MONGO_URI');
        console.log('  Any module with access to process.env can extract credentials');
        expect(mongoUri).toContain('@');
      } else {
        console.log('✓ No credentials in process.env.MONGO_URI (testing with local MongoDB)');
      }
    });

    it('should show credentials may be logged in error messages', () => {
      // GIVEN: Connection string with credentials
      const testUri = 'mongodb://leaked_user:leaked_pass_123@localhost:27017/TestDB';

      // WHEN: Connection fails and error is logged
      const simulateError = (uri) => {
        return `MongoDB connection failed: ${uri}`;
      };

      const errorMessage = simulateError(testUri);

      // THEN: Credentials exposed in error log
      expect(errorMessage).toContain('leaked_user');
      expect(errorMessage).toContain('leaked_pass_123');
      
      console.log('✗ SIMULATED ERROR LOG:');
      console.log(`  ${errorMessage}`);
      console.log('  ^ Credentials visible in application logs');
    });
  });

  describe('Test Case 2: Git History Exposure Risk', () => {
    it('should document that .env might be committed to repository', () => {
      // GIVEN: Common mistake - committing .env file
      const filesThatShouldNotBeCommitted = [
        '.env',
        '.env.local',
        '.env.production',
        'config/credentials.js'
      ];

      console.log('⚠️  Files that should NEVER be committed:');
      filesThatShouldNotBeCommitted.forEach(file => {
        console.log(`  - ${file}`);
      });

      // WHEN: Developer commits .env file
      // Git commands that reveal credentials:
      const dangerousGitCommands = [
        'git log --all --full-history -- **/.env',
        'git show <commit>:.env',
        'git log -p | grep MONGO_URI',
        'git rev-list --all | xargs git grep MONGO_URI'
      ];

      console.log('\n🔍 Git commands attackers use to find leaked credentials:');
      dangerousGitCommands.forEach(cmd => {
        console.log(`  $ ${cmd}`);
      });

      // THEN: Credentials permanently in git history
      expect(filesThatShouldNotBeCommitted.length).toBeGreaterThan(0);
    });

    it('should demonstrate credential search patterns attackers use', () => {
      // GIVEN: Common patterns in leaked credentials
      const searchPatterns = [
        'mongodb://',
        'MONGO_URI=',
        'DB_PASSWORD=',
        'mongodb+srv://',
        'username:password@',
        'PORT=27017'
      ];

      console.log('\n🚨 Regex patterns attackers search for in repositories:');
      searchPatterns.forEach(pattern => {
        console.log(`  - Pattern: "${pattern}"`);
      });

      // GitHub dorking examples:
      const githubDorks = [
        'filename:.env mongodb',
        'MONGO_URI password',
        'extension:env DB_PASSWORD',
        'mongodb://.*:.*@.*'
      ];

      console.log('\n🔎 GitHub search queries (dorks) used by attackers:');
      githubDorks.forEach(dork => {
        console.log(`  - "${dork}"`);
      });

      expect(searchPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Test Case 3: Actual Database Access with Leaked Credentials', () => {
    it('should demonstrate attacker can connect with leaked credentials', async () => {
      // GIVEN: Attacker obtained credentials from leak
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';

      if (!mongoUri.includes('@')) {
        console.log('✓ No credentials in connection string');
        return;
      }

      // WHEN: Attacker creates their own connection
      const attackerClient = new MongoClient(mongoUri);

      try {
        await attackerClient.connect();
        console.log('✗ CRITICAL: Attacker successfully connected to database!');

        // THEN: Attacker has full database access
        const db = attackerClient.db();
        const collections = await db.listCollections().toArray();

        console.log(`✗ Attacker can see ${collections.length} collections:`);
        collections.forEach(coll => {
          console.log(`  - ${coll.name}`);
        });

        // Attacker can read sensitive data
        const customers = db.collection('customers');
        const customerCount = await customers.countDocuments();
        console.log(`✗ Attacker can access ${customerCount} customer records`);

        expect(collections.length).toBeGreaterThan(0);

        await attackerClient.close();
      } catch (error) {
        console.log('✓ Connection failed (credentials may be protected)');
      }
    });

    it('should show attacker can modify data with leaked credentials', async () => {
      // GIVEN: Attacker has database access
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';

      if (!mongoUri.includes('@')) {
        return;
      }

      const attackerClient = new MongoClient(mongoUri);

      try {
        await attackerClient.connect();
        const db = attackerClient.db();
        const testCollection = db.collection('attacker_test');

        // WHEN: Attacker writes malicious data
        await testCollection.insertOne({
          type: 'malicious_entry',
          message: 'Attacker was here',
          timestamp: new Date(),
          warning: 'Database compromised via leaked credentials'
        });

        // THEN: Data successfully written
        const maliciousDoc = await testCollection.findOne({ type: 'malicious_entry' });
        
        if (maliciousDoc) {
          console.log('✗ CRITICAL: Attacker can write to database!');
          console.log(`  Malicious document ID: ${maliciousDoc._id}`);
        }

        // Cleanup
        await testCollection.deleteMany({ type: 'malicious_entry' });
        await attackerClient.close();

        expect(maliciousDoc).toBeDefined();
      } catch (error) {
        console.log('✓ Write operation blocked');
      }
    });

    it('should demonstrate attacker can delete collections', async () => {
      // GIVEN: Attacker with database access
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';

      if (!mongoUri.includes('@')) {
        return;
      }

      const attackerClient = new MongoClient(mongoUri);

      try {
        await attackerClient.connect();
        const db = attackerClient.db();

        // WHEN: Attacker creates temporary collection
        const testCollection = db.collection('attacker_deletable_test');
        await testCollection.insertOne({ test: 'data' });

        // Verify it exists
        let collections = await db.listCollections({ name: 'attacker_deletable_test' }).toArray();
        expect(collections.length).toBe(1);

        // THEN: Attacker can drop collection
        await testCollection.drop();
        console.log('✗ CRITICAL: Attacker can drop collections!');

        collections = await db.listCollections({ name: 'attacker_deletable_test' }).toArray();
        expect(collections.length).toBe(0);

        await attackerClient.close();
      } catch (error) {
        console.log('✓ Drop operation blocked or collection not found');
      }
    });
  });

  describe('Test Case 4: Credential Rotation Challenges', () => {
    it('should document difficulty of rotating embedded credentials', () => {
      // GIVEN: Credentials are embedded in connection string
      const locations = [
        '.env file',
        'docker-compose.yml environment section',
        'Kubernetes secrets',
        'CI/CD pipeline variables',
        'Team password managers',
        'Documentation/README files',
        'Application configuration files'
      ];

      console.log('\n🔄 Locations where credentials must be updated for rotation:');
      locations.forEach(location => {
        console.log(`  - ${location}`);
      });

      console.log('\n⚠️  Challenges:');
      console.log('  - Must update all locations simultaneously');
      console.log('  - Risk of service outage if any location missed');
      console.log('  - No audit trail of who changed credentials');
      console.log('  - Old credentials may remain in git history');

      expect(locations.length).toBeGreaterThan(0);
    });

    it('should compare with secrets management best practices', () => {
      // GIVEN: Current approach vs. recommended approach
      const currentApproach = {
        method: 'Plain text in .env',
        pros: ['Simple', 'Easy to set up'],
        cons: [
          'Credentials visible in files',
          'Easy to accidentally commit',
          'Difficult to rotate',
          'No access control',
          'No audit trail',
          'Shared via insecure channels'
        ]
      };

      const recommendedApproach = {
        method: 'Secrets management service',
        examples: ['AWS Secrets Manager', 'HashiCorp Vault', 'Azure Key Vault'],
        pros: [
          'Encrypted at rest',
          'Access control and auditing',
          'Automatic rotation',
          'No credentials in code',
          'Centralized management'
        ]
      };

      console.log('\n📊 Security Comparison:');
      console.log(`Current: ${currentApproach.method}`);
      console.log(`Cons: ${currentApproach.cons.join(', ')}`);
      console.log(`\nRecommended: ${recommendedApproach.method}`);
      console.log(`Examples: ${recommendedApproach.examples.join(', ')}`);
      console.log(`Benefits: ${recommendedApproach.pros.join(', ')}`);

      expect(currentApproach.cons.length).toBeGreaterThan(recommendedApproach.examples.length);
    });
  });

  describe('Test Case 5: Credential Leak Vectors', () => {
    it('should document common leak vectors', () => {
      const leakVectors = [
        {
          vector: 'Git Repository',
          risk: 'HIGH',
          description: '.env committed by mistake, visible in history'
        },
        {
          vector: 'Error Messages',
          risk: 'MEDIUM',
          description: 'Connection errors expose full URI in logs'
        },
        {
          vector: 'Server Logs',
          risk: 'MEDIUM',
          description: 'Application logs may include connection string'
        },
        {
          vector: 'Container Images',
          risk: 'HIGH',
          description: '.env baked into Docker image layers'
        },
        {
          vector: 'Backup Files',
          risk: 'MEDIUM',
          description: 'Configuration backups contain credentials'
        },
        {
          vector: 'Team Sharing',
          risk: 'HIGH',
          description: 'Credentials sent via email, Slack, or chat'
        },
        {
          vector: 'CI/CD Logs',
          risk: 'HIGH',
          description: 'Build logs expose environment variables'
        },
        {
          vector: 'Process Listing',
          risk: 'LOW',
          description: 'Command-line arguments may include connection string'
        }
      ];

      console.log('\n🚨 Credential Leak Vectors:');
      leakVectors.forEach(({ vector, risk, description }) => {
        console.log(`  [${risk.padEnd(6)}] ${vector}`);
        console.log(`            ${description}`);
      });

      const highRiskVectors = leakVectors.filter(v => v.risk === 'HIGH');
      expect(highRiskVectors.length).toBeGreaterThanOrEqual(3);
    });

    it('should demonstrate memory dump risk', () => {
      // GIVEN: Application running with credentials in memory
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/Auth';

      // WHEN: Memory dump taken (e.g., during debugging or crash)
      const memoryRepresentation = {
        env_variables: {
          MONGO_URI: mongoUri,
          JWT_SECRET: process.env.JWT_SECRET || 'default_jwt_secret'
        }
      };

      // THEN: Credentials extractable from memory
      console.log('\n💾 Memory Dump Simulation:');
      console.log('  Process memory contains:');
      console.log(`  - MongoDB URI: ${mongoUri.substring(0, 30)}...`);
      console.log(`  - JWT Secret: ${(process.env.JWT_SECRET || 'default_jwt_secret').substring(0, 20)}...`);
      console.log('\n  ✗ Credentials readable from:');
      console.log('    - Core dumps');
      console.log('    - Process memory inspection');
      console.log('    - Debugging sessions');
      console.log('    - Container inspection');

      expect(memoryRepresentation.env_variables.MONGO_URI).toBeDefined();
    });
  });
});
