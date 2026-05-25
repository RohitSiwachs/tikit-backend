import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { Expo } from 'expo-server-sdk';

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

  async triggerSend(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign with ID ${id} not found`);
    if (campaign.status === 'sent') throw new BadRequestException('Campaign already sent');

    const filters: any = (campaign.segmentFilters as any) ?? {};

    const whereClause: any = {};
    if (filters.schoolId) whereClause.schoolId = filters.schoolId;
    if (filters.className) whereClause.className = filters.className;
    if (filters.role) whereClause.role = filters.role;

    const audience = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true, phone: true, email: true, expoPushToken: true }
    });

    let sentCount = 0;
    const username = process.env.ELKS_USERNAME;
    const password = process.env.ELKS_PASSWORD;
    const expo = new Expo();

    const sendSms = async (phone: string, message: string) => {
      if (username && password) {
        try {
          const res = await fetch('https://api.46elks.com/a1/sms', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              from: 'TiKit',
              to: phone,
              message
            })
          });
          return res.ok;
        } catch (err) {
          console.error('Failed to send SMS via 46elks', err);
          return false;
        }
      } else {
        // Mock send if credentials aren't set — never log phone numbers
        console.log('[dev] SMS mock send (set ELKS_USERNAME/PASSWORD to enable real delivery)');
        return true;
      }
    };

    if (campaign.channel === 'push') {
      const messages: any[] = [];
      for (const user of audience) {
        if (user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
          messages.push({
            to: user.expoPushToken,
            sound: 'default',
            title: campaign.title,
            body: campaign.body,
            data: { campaignId: campaign.id },
          });
        }
      }

      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            sentCount += ticketChunk.length;
          } catch (error) {
            console.error('Error sending Expo push notifications:', error);
          }
        }
      }
    } else if (campaign.channel === 'sms') {
      for (const user of audience) {
        if (user.phone) {
          const success = await sendSms(user.phone, campaign.body);
          if (success) sentCount++;
        }
      }
    } else {
      // Email logic (mocked for now)
      sentCount = audience.length;
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'sent',
        sentCount,
      }
    });
  }

  async getReport(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign with ID ${id} not found`);

    const openRate = campaign.sentCount > 0 
      ? (campaign.openCount / campaign.sentCount) * 100 
      : 0;

    return {
      campaignId: campaign.id,
      title: campaign.title,
      channel: campaign.channel,
      status: campaign.status,
      sentCount: campaign.sentCount,
      openCount: campaign.openCount,
      openRate: openRate.toFixed(2) + '%',
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
    };
  }
}
