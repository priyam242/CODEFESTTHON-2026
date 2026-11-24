import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('items')
export class ItemsController {
  constructor(private itemsService: ItemsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('move-in')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadMoveIn(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    const { tenancyId, roomName, itemName, moveInNotes, base64Photo, photoHash } = body;
    if (!tenancyId || !roomName || !itemName) {
      throw new BadRequestException('tenancyId, roomName, and itemName are required');
    }
    return this.itemsService.moveIn(
      tenancyId,
      roomName,
      itemName,
      moveInNotes,
      file,
      base64Photo,
      photoHash,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/move-out')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadMoveOut(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    const { moveOutNotes, base64Photo, forensics } = body || {};
    return this.itemsService.moveOut(id, moveOutNotes, file, base64Photo, forensics);
  }

  @Get('tenancy/:tenancyId')
  async getByTenancy(@Param('tenancyId') tenancyId: string) {
    return this.itemsService.findByTenancy(tenancyId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }
}
