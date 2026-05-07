import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { Follow } from '../entities/follow.entity.js';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Follow) private readonly followRepo: Repository<Follow>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['school'],
    });
    if (!user) throw new NotFoundException('User not found');
    const followersCount = await this.followRepo.count({ where: { following_id: userId } });
    const followingCount = await this.followRepo.count({ where: { follower_id: userId } });
    return {
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      avatar_url: user.avatar_url,
      school: user.school ? { name: user.school.name, year: `Åk ${user.school_year}` } : null,
      followers_count: followersCount,
      following_count: followingCount,
      role: user.role,
    };
  }

  async getFollowers(userId: string, search?: string, page = 1, limit = 20) {
    const qb = this.followRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.follower', 'u')
      .leftJoinAndSelect('u.school', 's')
      .where('f.following_id = :userId', { userId });
    if (search) {
      qb.andWhere('u.display_name ILIKE :search', { search: `%${search}%` });
    }
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, meta: { page, total_pages: Math.ceil(total / limit), total_count: total } };
  }

  async getFollowing(userId: string, search?: string, page = 1, limit = 20) {
    const qb = this.followRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.following', 'u')
      .leftJoinAndSelect('u.school', 's')
      .where('f.follower_id = :userId', { userId });
    if (search) {
      qb.andWhere('u.display_name ILIKE :search', { search: `%${search}%` });
    }
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, meta: { page, total_pages: Math.ceil(total / limit), total_count: total } };
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ConflictException('Cannot follow yourself');
    const exists = await this.followRepo.findOne({
      where: { follower_id: followerId, following_id: followingId },
    });
    if (exists) throw new ConflictException('Already following');
    await this.followRepo.save({ follower_id: followerId, following_id: followingId });
    return { following: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const result = await this.followRepo.delete({
      follower_id: followerId,
      following_id: followingId,
    });
    if (result.affected === 0) throw new NotFoundException('Not following');
    return { following: false };
  }

  async getSuggestions(userId: string) {
    // Suggest users from same school who are not followed
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.school_id) return { data: [] };
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.school', 's')
      .where('u.school_id = :schoolId', { schoolId: user.school_id })
      .andWhere('u.id != :userId', { userId })
      .andWhere(
        `u.id NOT IN (SELECT f.following_id FROM follows f WHERE f.follower_id = :userId)`,
        { userId },
      )
      .take(10);
    const data = await qb.getMany();
    return { data };
  }
}
