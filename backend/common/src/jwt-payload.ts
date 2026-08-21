export type Role = 'admin' | 'vendedor';

/**
 * Claims del access token JWT (RS256). `sub` = id del usuario en users_db.
 */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}
