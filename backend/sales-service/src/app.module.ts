import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AllExceptionsFilter,
  HealthController,
  JwtAuthGuard,
  JwtStrategy,
  RolesGuard,
} from '@app/common';
import { Product } from './entities/product.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'pos_app',
      password: process.env.DB_PASSWORD ?? 'pos_app_dev',
      database: process.env.DB_NAME ?? 'sales_db',
      entities: [Product, Sale, SaleItem],
      synchronize: false,
      logging: ['error'],
    }),
    TypeOrmModule.forFeature([Sale]),
  ],
  controllers: [SalesController, HealthController],
  providers: [
    SalesService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
