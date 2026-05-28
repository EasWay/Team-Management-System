declare module 'speakeasy' {
  export interface GenerateSecretOptions {
    length?: number;
    name?: string;
    issuer?: string;
    symbols?: boolean;
    otpauth_url?: boolean;
    qr_codes?: string[];
    google_auth_qr?: boolean;
  }

  export interface SecretKey {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
    google_auth_qr?: string;
  }

  export interface TOTPOptions {
    secret: string;
    encoding?: string;
    period?: number;
    digits?: number;
    algorithm?: string;
    token?: string;
    window?: number;
    time?: number;
    step?: number;
  }

  export interface TOTPVerifyOptions extends TOTPOptions {
    token: string;
  }

  export function generateSecret(options?: GenerateSecretOptions): SecretKey;

  export const totp: {
    generate(options: TOTPOptions): string;
    verify(options: TOTPVerifyOptions): boolean | { delta: number };
  };

  export const hotp: {
    generate(options: any): string;
    verify(options: any): boolean | { delta: number };
  };
}
