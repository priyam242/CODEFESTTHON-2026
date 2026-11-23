import { IsNotEmpty, IsString, IsNumber, Min, IsOptional, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenancyDto {
  @IsNotEmpty()
  @IsString()
  propertyTitle!: string;

  @IsNotEmpty()
  @IsString()
  propertyAddress!: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount!: number;

  @IsNotEmpty()
  @IsString()
  landlordName!: string;

  @IsNotEmpty()
  @IsString()
  landlordPhone!: string;

  @IsOptional()
  @IsEmail()
  landlordEmail?: string;

  @IsOptional()
  @IsString()
  landlordUpi?: string;

  @IsOptional()
  @IsString()
  agreementRef?: string;
}
