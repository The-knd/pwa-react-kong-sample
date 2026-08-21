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
import { Client } from './entities/client.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'pos_app',
      password: process.env.DB_PASSWORD ?? 'pos_app_dev',
      database: process.env.DB_NAME ?? 'clients_db',
      entities: [Client],
      synchronize: false,
      logging: ['error'],
    }),
    TypeOrmModule.forFeature([Client]),
  ],
  controllers: [ClientsController, HealthController],
  providers: [
    ClientsService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
