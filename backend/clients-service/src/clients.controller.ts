import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { JwtPayload, Roles } from '@app/common';
import { Request } from 'express';
import { CreateClientDto, ListClientsQueryDto } from './dto/create-client.dto';
import { ClientsService } from './clients.service';

@Roles('admin', 'vendedor')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto, @Req() req: Request & { user: JwtPayload }) {
    return this.clientsService.create(dto, req.user);
  }

  @Get()
  findAll(@Query() query: ListClientsQueryDto) {
    return this.clientsService.findAll(query);
  }
}
