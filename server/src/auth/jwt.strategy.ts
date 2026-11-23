import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'rentshield-secret-key-fallback',
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or token revoked');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
      address: user.address || null,
      upiId: user.upiId || null,
    };
  }
}
