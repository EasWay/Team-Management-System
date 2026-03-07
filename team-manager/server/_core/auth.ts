import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './env';
import * as bcrypt from 'bcrypt';

const TOKEN_EXPIRY = '7d'; // 7 days
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days
const BCRYPT_SALT_ROUNDS = 10;

interface TokenPayload extends Record<string, unknown> {
  userId: string;
  email: string;
  name?: string;
  type: 'access' | 'refresh';
}

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

export class AuthService {
  private getSecret() {
    return new TextEncoder().encode(ENV.jwtSecret);
  }

  async generateAccessToken(userId: string | number, email: string, name?: string): Promise<string> {
    const secret = this.getSecret();

    return await new SignJWT({
      userId: String(userId),
      email,
      name,
      type: 'access'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(secret);
  }

  async generateRefreshToken(userId: string | number, email: string, name?: string): Promise<string> {
    const secret = this.getSecret();

    return await new SignJWT({
      userId: String(userId),
      email,
      name,
      type: 'refresh'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(secret);
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const secret = this.getSecret();
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      return payload as unknown as TokenPayload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Hash a password using bcrypt with salt factor >= 10
   * @param password - The plain text password to hash
   * @returns Promise resolving to the bcrypt hash
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /**
   * Verify a password against a bcrypt hash
   * @param password - The plain text password to verify
   * @param hash - The bcrypt hash to compare against
   * @returns Promise resolving to true if password matches, false otherwise
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   * @param password - The password to validate
   * @returns Object with valid flag and array of error messages
   */
  validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format according to RFC 5322 (simplified)
   * @param email - The email to validate
   * @returns Object with valid flag and optional error message
   */
  validateEmail(email: string): EmailValidationResult {
    // RFC 5322 simplified regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return {
        valid: false,
        error: 'Invalid email format',
      };
    }

    return {
      valid: true,
    };
  }
}

export const authService = new AuthService();
