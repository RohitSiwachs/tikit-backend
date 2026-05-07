import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileService } from './profile.service.js';
import { ProfileController } from './profile.controller.js';
import { User } from '../entities/user.entity.js';
import { Follow } from '../entities/follow.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Follow])],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
