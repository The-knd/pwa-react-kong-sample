import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsIn(['admin', 'vendedor'])
  role!: 'admin' | 'vendedor';
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'vendedor'])
  role?: 'admin' | 'vendedor';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;
}
