import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { JwtPayload, Roles } from '@app/common';
import { Request } from 'express';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Roles('vendedor')
  @Post()
  create(@Body() dto: CreateSaleDto, @Req() req: Request & { user: JwtPayload }) {
    return this.salesService.create(dto, req.user);
  }

  @Roles('admin')
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.salesService.findAll(Number(limit ?? 50), Number(offset ?? 0));
  }
}
