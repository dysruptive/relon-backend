import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto, organizationId: string) {
    return this.prisma.product.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        defaultPrice: dto.defaultPrice ?? 0,
        unit: dto.unit,
        category: dto.category,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.product.delete({ where: { id } });
  }
}
