import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FileUploadResponseDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'DIAL Core URL of the uploaded file',
    example: 'files/my-bucket/folder/file.pdf',
  })
  url!: string;
}
