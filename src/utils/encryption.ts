import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key-12';
const ALGORITHM = 'aes-256-gcm';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt sensitive data (like PII)
 */
export const encrypt = async (text: string): Promise<EncryptedData> => {
  try {
    const iv = randomBytes(16);
    const key = await scryptAsync(ENCRYPTION_KEY, 'salt', 32) as Buffer;
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error('Encryption failed: ' + (error as Error).message);
  }
};

/**
 * Decrypt sensitive data
 */
export const decrypt = async (encryptedData: EncryptedData): Promise<string> => {
  try {
    const key = await scryptAsync(ENCRYPTION_KEY, 'salt', 32) as Buffer;
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + (error as Error).message);
  }
};

/**
 * Hash sensitive data for one-way encryption (like phone numbers for searching)
 */
export const hashData = async (data: string): Promise<string> => {
  const key = await scryptAsync(data, ENCRYPTION_KEY, 32) as Buffer;
  return key.toString('hex');
};

/**
 * Mask sensitive data for display (like phone numbers, emails)
 */
export const maskData = (data: string, type: 'email' | 'phone' | 'card' = 'email'): string => {
  if (!data) return '';
  
  switch (type) {
    case 'email':
      const [localPart, domain] = data.split('@');
      if (!domain) return data;
      const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(0, localPart.length - 2)) + localPart.slice(-1);
      return maskedLocal + '@' + domain;
      
    case 'phone':
      if (data.length < 4) return data;
      return '*'.repeat(data.length - 4) + data.slice(-4);
      
    case 'card':
      if (data.length < 4) return data;
      return '*'.repeat(data.length - 4) + data.slice(-4);
      
    default:
      return data;
  }
};

/**
 * Redact sensitive data from logs
 */
export const redactSensitiveData = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 'credit', 'card',
    'ssn', 'social', 'passport', 'license', 'account'
  ];
  
  const redacted = { ...obj };
  
  for (const key in redacted) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  
  return redacted;
};
