import { Controller, Post, Get, Body, UseGuards, Request, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

@Controller('auth')
export class UserController {
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const emailLower = (dto.email || '').trim().toLowerCase();
    const isDemo =
      emailLower === 'tenant.demo@rentshield.com' ||
      emailLower === 'landlord.demo@rentshield.com';

    let user = await this.userService.findByEmail(emailLower);
    if (user && isDemo) {
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
      return {
        access_token: token,
        user: this.userService.toResponse(user),
      };
    }

    if (!user) {
      user = await this.userService.create(dto.email, dto.password, dto.role || 'TENANT', dto.name || '');
    } else {
      throw new ConflictException('User with this email already exists');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    return {
      access_token: token,
      user: this.userService.toResponse(user),
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
