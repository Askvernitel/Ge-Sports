export interface AccessTokenPayload {
  sub: string; // userId
  role: 'user' | 'admin' | 'support';
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  version: number;
}

export interface AuthenticatedUser {
  id: string;
  role: 'user' | 'admin' | 'support';
  email: string;
}
