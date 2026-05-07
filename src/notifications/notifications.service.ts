import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
  ) {}

  async getAll(userId: string) {
    const [data, total] = await this.repo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
    const unread_count = await this.repo.count({ where: { user_id: userId, is_read: false } });
    return { unread_count, data };
  }

  async markRead(notificationId: string) {
    await this.repo.update(notificationId, { is_read: true });
    return { success: true };
  }
}
