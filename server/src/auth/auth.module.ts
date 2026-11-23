import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'rentshield-super-secret-key-change-in-production-2026',
        signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, LocalStrategy, JwtStrategy],
  exports: [UserService, AuthService, JwtModule],
})
export class AuthModule {}
