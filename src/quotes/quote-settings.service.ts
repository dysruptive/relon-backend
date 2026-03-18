import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateQuoteSettingsDto } from './dto/quotes.dto';

@Injectable()
export class QuoteSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    return this.prisma.quoteSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId, companyName: org?.name ?? '' },
    });
  }

  async updateSettings(organizationId: string, dto: UpdateQuoteSettingsDto) {
    return this.prisma.quoteSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
  }
}
