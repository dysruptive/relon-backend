import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/products.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions('quotes:read')
  findAll(
    @CurrentUser() user: any,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.productsService.findAll(user.organizationId, includeInactive === 'true');
  }

  @Get(':id')
  @Permissions('quotes:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, user.organizationId);
  }

  @Post()
  @Permissions('settings:manage')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, user.organizationId);
  }

  @Patch(':id')
  @Permissions('settings:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('settings:manage')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.delete(id, user.organizationId);
  }
}
