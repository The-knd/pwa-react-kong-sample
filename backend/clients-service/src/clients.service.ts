import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayload } from '@app/common';
import { Repository } from 'typeorm';
import { CreateClientDto, ListClientsQueryDto } from './dto/create-client.dto';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto, actor: JwtPayload) {
    try {
      return await this.clientsRepo.save({
        docType: dto.docType,
        docNumber: dto.docNumber,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        createdBy: actor.sub,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un cliente con ese documento');
      }
      throw error;
    }
  }

  async findAll(query: ListClientsQueryDto) {
    const [items, total] = await this.clientsRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });
    return { items, total };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505'
  );
}
