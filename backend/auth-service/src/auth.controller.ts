import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { JwtPayload, Public } from '@app/common';
import { CookieOptions, Request, Response } from 'express';
import { AuthService, REFRESH_TTL_MS } from './auth.service';
import { LoginDto } from './dto/login.dto';

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public() // el access token puede estar expirado; la autoridad es la cookie rt
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.refresh(req.cookies?.['rt']);
    this.setAuthCookies(res, tokens);
    return { refreshed: true };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.['rt']);
    res.clearCookie('at', { ...this.cookieBase(), maxAge: 0 });
    res.clearCookie('rt', { ...this.cookieBase(), maxAge: 0, path: REFRESH_PATH });
    return { loggedOut: true };
  }

  @Get('me')
  me(@Req() req: Request & { user: JwtPayload }) {
    return this.authService.me(req.user);
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('at', tokens.accessToken, {
      ...this.cookieBase(),
      maxAge: ACCESS_TTL_MS,
      path: '/',
    });
    res.cookie('rt', tokens.refreshToken, {
      ...this.cookieBase(),
      maxAge: REFRESH_TTL_MS,
      path: REFRESH_PATH,
    });
  }

  private cookieBase(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
    };
  }
}
