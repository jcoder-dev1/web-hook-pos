import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ description: 'Mobile number to send OTP to', example: '919588623393' })
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiProperty({ description: 'OTP code to send', example: '422259' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  otp: string;
}

