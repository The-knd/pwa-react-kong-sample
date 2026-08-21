import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload, Role } from '@app/common';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 min
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: { id: string; username: string; role: Role };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly privateKey = readFileSync(
    process.env.JWT_PRIVATE_KEY_PATH ?? '/secrets/jwt-private.pem',
  );

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'role', 'active', 'passwordHash'],
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: { id: user.id, username: user.username, role: user.role } };
  }

  /**
   * Rota el refresh token (un solo uso): revoca el entregado, emite uno nuevo
   * y un access token fresco. Todo en una transacción.
   */
  async refresh(rawRefreshToken: string | undefined): Promise<TokenPair> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokenHash = sha256(rawRefreshToken);

    return this.dataSource.transaction(async (manager) => {
      const stored = await manager.findOneBy(RefreshToken, { tokenHash });
      if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      const user = await manager.findOneBy(User, { id: stored.userId });
      if (!user || !user.active) {
        throw new UnauthorizedException('Usuario inactivo');
      }

      stored.revoked = true;
      await manager.save(stored);

      const rawNew = randomBytes(48).toString('hex');
      await manager.insert(RefreshToken, {
        userId: user.id,
        tokenHash: sha256(rawNew),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      });

      const accessToken = await this.signAccessToken(user);
      return { accessToken, refreshToken: rawNew };
    });
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    try {
      await this.refreshRepo.update(
        { tokenHash: sha256(rawRefreshToken) },
        { revoked: true },
      );
    } catch (error) {
      this.logger.warn(`logout: no se pudo revocar el token (${String(error)})`);
    }
  }

  me(payload: JwtPayload) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = randomBytes(48).toString('hex');

    await this.refreshRepo.insert({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return { accessToken, refreshToken };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, username: user.username, role: user.role },
      { secret: this.privateKey, algorithm: 'RS256', expiresIn: '15m' },
    );
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
