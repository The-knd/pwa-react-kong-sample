import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { User } from './entities/user.entity';

const SAFE_COLUMNS = ['id', 'username', 'role', 'active', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async create(dto: CreateUserDto) {
    try {
      const user = await this.usersRepo.save({
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
      });
      return this.toSafe(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`El usuario "${dto.username}" ya existe`);
      }
      throw error;
    }
  }

  async findAll() {
    const users = await this.usersRepo.find({
      select: [...SAFE_COLUMNS],
      order: { createdAt: 'DESC' },
    });
    return users;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.role !== undefined) user.role = dto.role;
    if (dto.active !== undefined) user.active = dto.active;
    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    await this.usersRepo.save(user);
    return this.toSafe(user);
  }

  private toSafe(user: User) {
    const { passwordHash: _ignored, ...safe } = user;
    return safe;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505'
  );
}
