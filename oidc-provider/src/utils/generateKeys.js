/**
 * RSA Key Generation Utility
 * Run: node src/utils/generateKeys.js
 * Copy the output into your .env file
 */

const { generateKeyPairSync } = require('crypto');

function generateRSAKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const kid = `key-${Date.now()}`;

  const privateKeyJSON = JSON.stringify({ pem: privateKey, kid });
  const publicKeyJSON = JSON.stringify({ pem: publicKey, kid });

  console.log('\n=== RSA Key Pair Generated ===\n');
  console.log('Add these to your .env file:\n');
  console.log(`PRIVATE_KEY_JSON=${privateKeyJSON}`);
  console.log(`PUBLIC_KEY_JSON=${publicKeyJSON}`);
  console.log('\n==============================\n');

  return { privateKey, publicKey, kid };
}

generateRSAKeyPair();