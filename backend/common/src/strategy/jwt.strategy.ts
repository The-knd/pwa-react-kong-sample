import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { readFileSync } from 'node:fs';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../jwt-payload';

interface CookieRequest {
  cookies?: Record<string, string>;
}

/**
 * Extrae el access token de la cookie httpOnly `at` (nunca del body/URL)
 * y verifica firma RS256 + expiración con la clave pública compartida.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: CookieRequest) => req?.cookies?.['at'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: readFileSync(process.env.JWT_PUBLIC_KEY_PATH ?? '/secrets/jwt-public.pem'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
