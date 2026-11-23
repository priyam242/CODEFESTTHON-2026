import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  upiId?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
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
      user = await this.userService.create(
        dto.email,
        dto.password,
        dto.role || 'TENANT',
        dto.name || '',
        dto.avatarUrl,
        dto.address,
        dto.upiId,
      );
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
  async getProfile(@Request() req: any) {
    const userId = req.user.id || req.user.sub;
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return this.userService.toResponse(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfilePatch(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.handleUpdateProfile(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfilePut(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.handleUpdateProfile(req.user, dto);
  }

  private async handleUpdateProfile(authUser: any, dto: UpdateProfileDto) {
    const userId = authUser.id || authUser.sub;
    const updatedUser = await this.userService.updateProfile(userId, dto);

    const token = this.jwtService.sign({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      name: updatedUser.name,
    });

    return {
      user: this.userService.toResponse(updatedUser),
      access_token: token,
      message: 'Profile settings successfully updated',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  async deleteAccount(@Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.userService.deleteAccount(userId);
  }
}
