import { describe, it, expect } from 'vitest';
import { authService } from './_core/auth';

/**
 * Unit tests for password hashing and validation utilities
 * Tests bcrypt password hashing, verification, and validation functions
 * 
 * **Validates: Requirements 3.1, 3.2, 1.3, 1.4, 7.2, 7.6**
 */

describe('AuthService - Password Hashing and Validation', () => {
  describe('Password Hashing (hashPassword)', () => {
    it('should hash a password successfully', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const password = 'TestPassword123!';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce bcrypt format hashes', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('Password Verification (verifyPassword)', () => {
    it('should verify correct password against hash', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty password verification', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword('', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Password Strength Validation (validatePasswordStrength)', () => {
    it('should accept password with 8+ characters', () => {
      const result = authService.validatePasswordStrength('ValidPass123');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password with less than 8 characters', () => {
      const result = authService.validatePasswordStrength('Short1!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject empty password', () => {
      const result = authService.validatePasswordStrength('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should accept exactly 8 character password', () => {
      const result = authService.validatePasswordStrength('Exactly8');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept long passwords', () => {
      const result = authService.validatePasswordStrength('VeryLongPasswordWith32CharactersOrMore!');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Email Validation (validateEmail)', () => {
    it('should accept valid email format', () => {
      const result = authService.validateEmail('user@example.com');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept email with subdomain', () => {
      const result = authService.validateEmail('user@mail.example.com');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject email without @ symbol', () => {
      const result = authService.validateEmail('userexample.com');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject email without domain', () => {
      const result = authService.validateEmail('user@');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject email without local part', () => {
      const result = authService.validateEmail('@example.com');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject email with spaces', () => {
      const result = authService.validateEmail('user @example.com');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject empty email', () => {
      const result = authService.validateEmail('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should accept email with numbers and special characters in local part', () => {
      const result = authService.validateEmail('user.name+tag@example.com');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});