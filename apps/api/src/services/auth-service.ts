import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import type { AuthenticatedUser, UserRole } from '../domain/types.js';
import type { Database } from '../database/client.js';
import { HttpError } from './http-error.js';

type UserRow = {
  id: string;
  workspace_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  enabled: boolean;
};

const DUMMY_PASSWORD_HASH = '$2b$12$LpTD3GPhOMtlWRqPm1hpNOC5usVkQyiVScon4W82oc0Lod9nLLQee';

export type LoginResult = {
  accessToken: string;
  expiresIn: string;
  user: AuthenticatedUser & { displayName: string };
};

export type LiveTokenResult = {
  token: string;
  expiresInSeconds: number;
};

export class AuthService {
  constructor(
    private readonly database: Database,
    private readonly config: AppConfig,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.database.query<UserRow>(
      `SELECT id, workspace_id, email, display_name, password_hash, role, enabled
       FROM identity.users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.enabled || !passwordMatches) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const claims: AuthenticatedUser = {
      id: user.id,
      workspaceId: user.workspace_id,
      email: user.email,
      role: user.role,
    };
    const accessToken = jwt.sign(claims, this.config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: this.config.jwtExpiresIn as SignOptions['expiresIn'],
      issuer: 'relayops-api',
      audience: 'relayops-control-plane',
      subject: user.id,
    });

    await this.database.query('UPDATE identity.users SET last_login_at = now() WHERE id = $1', [
      user.id,
    ]);

    return {
      accessToken,
      expiresIn: this.config.jwtExpiresIn,
      user: { ...claims, displayName: user.display_name },
    };
  }

  verify(token: string): AuthenticatedUser {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'relayops-api',
        audience: 'relayops-control-plane',
      });
      if (typeof decoded === 'string') throw new Error('Invalid claims');

      return {
        id: String(decoded.id),
        workspaceId: String(decoded.workspaceId),
        email: String(decoded.email),
        role: decoded.role as UserRole,
      };
    } catch {
      throw new HttpError(401, 'Invalid or expired access token', 'INVALID_TOKEN');
    }
  }

  issueLiveToken(user: AuthenticatedUser): LiveTokenResult {
    const expiresInSeconds = 60;
    const token = jwt.sign({ ...user, purpose: 'live' }, this.config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: expiresInSeconds,
      issuer: 'relayops-api',
      audience: 'relayops-live',
      subject: user.id,
    });
    return { token, expiresInSeconds };
  }

  verifyLiveToken(token: string): AuthenticatedUser {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'relayops-api',
        audience: 'relayops-live',
      });
      if (typeof decoded === 'string' || decoded.purpose !== 'live')
        throw new Error('Invalid claims');
      return {
        id: String(decoded.id),
        workspaceId: String(decoded.workspaceId),
        email: String(decoded.email),
        role: decoded.role as UserRole,
      };
    } catch {
      throw new HttpError(401, 'Invalid or expired live connection ticket', 'INVALID_LIVE_TOKEN');
    }
  }
}
