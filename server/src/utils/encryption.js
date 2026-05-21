import crypto from 'crypto';

/**
 * ENCRYPTION UTILITY
 * 
 * WHY ENCRYPTION FOR SESSION COOKIES?
 * 1. DATABASE SECURITY: Even if MongoDB is compromised, cookies are encrypted
 * 2. COMPLIANCE: Sensitive credentials should never be in plain text
 * 3. BEST PRACTICE: Never store API keys/sessions in database unencrypted
 * 4. DEFENSE IN DEPTH: Multiple security layers
 * 
 * HOW IT WORKS:
 * - Uses AES-256-GCM (industry standard, authenticated encryption)
 * - IV (initialization vector) is random for each encryption
 * - GCM mode provides authentication + integrity checking
 * - IV is stored with ciphertext (safe to store together)
 * 
 * IMPORTANT SECURITY NOTES:
 * 1. ENCRYPTION_KEY must be stored in environment variables
 * 2. NEVER hardcode keys
 * 3. NEVER log encrypted or decrypted values
 * 4. Key rotation is manual (change env var and re-encrypt)
 * 5. Only store encrypted in database - never plain text
 */

// Must be exactly 32 bytes (256 bits) for AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-bytes-for-dev-only!!';

if (ENCRYPTION_KEY.length < 32) {
    console.warn('⚠️  WARNING: ENCRYPTION_KEY is less than 32 bytes. Set ENCRYPTION_KEY env variable with a 32-byte key');
}

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(ENCRYPTION_KEY.substring(0, 32));

/**
 * Encrypt sensitive data (like LeetCode session cookies)
 * 
 * @param {string} plaintext - The sensitive data to encrypt
 * @returns {string} Encrypted data in format: iv:authTag:encryptedData (all hex-encoded)
 * 
 * NEVER DO THIS:
 * - Encrypt to database without proper handling
 * - Log the plaintext or ciphertext
 * - Use same IV twice
 * 
 * ALWAYS DO THIS:
 * - Use returned encrypted value directly
 * - Store only encrypted value in database
 * - Decrypt only when needed for API calls
 */
export function encrypt(plaintext) {
    // Generate random IV (16 bytes)
    const iv = crypto.randomBytes(16);

    // Create cipher with IV
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    // Encrypt the data
    let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;
}

/**
 * Decrypt sensitive data
 * 
 * @param {string} encrypted - Encrypted data in format: iv:authTag:encryptedData
 * @returns {string|null} Decrypted plaintext, or null if decryption fails
 * 
 * WHY RETURN NULL ON FAILURE?
 * - Invalid/tampered data should fail gracefully
 * - Prevents exposing decryption errors to users
 * - Allows checking: if (!decrypted) { return error; }
 */
export function decrypt(encrypted) {
    try {
        // Parse the encrypted format
        const parts = encrypted.split(':');
        if (parts.length !== 3) {
            console.error('❌ Invalid encrypted format');
            return null;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedData = parts[2];

        // Create decipher with IV
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

        // Set authentication tag for verification
        decipher.setAuthTag(authTag);

        // Decrypt the data
        let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
        decryptedData += decipher.final('utf8');

        return decryptedData;
    } catch (error) {
        // Silently fail - could be wrong key or corrupted data
        return null;
    }
}

/**
 * Hash a value (one-way, for comparison)
 * Used for verifying encrypted values without decrypting
 * 
 * @param {string} value - Value to hash
 * @returns {string} SHA-256 hash in hex
 */
export function hashValue(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export default {
    encrypt,
    decrypt,
    hashValue
};
