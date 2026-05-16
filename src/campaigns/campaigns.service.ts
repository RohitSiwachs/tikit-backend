import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createCampaignDto: CreateCampaignDto) {
    const data: any = { ...createCampaignDto };
    if (data.scheduledAt) {
      data.scheduledAt = new Date(data.scheduledAt);
    }
    return this.prisma.campaign.create({
      data,
    });
  }

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign with ID ${id} not found`);
    return campaign;
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    const data: any = { ...updateCampaignDto };
    if (data.scheduledAt) {
      data.scheduledAt = new Date(data.scheduledAt);
    }
    return this.prisma.campaign.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }
}
