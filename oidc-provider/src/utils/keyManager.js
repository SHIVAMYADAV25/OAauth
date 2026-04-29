/**
 * Key Manager - Loads and caches RSA keys for signing/verifying JWTs
 */

const { importPKCS8, importSPKI, exportJWK } = require('jose');

let privateKey = null;
let publicKey = null;
let kid = null;

async function loadKeys() {
  if (privateKey && publicKey) return;

  const privateKeyData = JSON.parse(process.env.PRIVATE_KEY_JSON);
  const publicKeyData = JSON.parse(process.env.PUBLIC_KEY_JSON);

  kid = privateKeyData.kid;
  privateKey = await importPKCS8(privateKeyData.pem, 'RS256');
  publicKey = await importSPKI(publicKeyData.pem, 'RS256');

  console.log(`[Keys] Loaded key pair: ${kid}`);
}

async function getPrivateKey() {
  await loadKeys();
  return { key: privateKey, kid };
}

async function getPublicKey() {
  await loadKeys();
  return { key: publicKey, kid };
}

async function getJWKS() {
  await loadKeys();
  const jwk = await exportJWK(publicKey);
  return {
    keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }],
  };
}

module.exports = { getPrivateKey, getPublicKey, getJWKS, loadKeys };