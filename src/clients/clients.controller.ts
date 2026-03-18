import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Permissions('clients:view')
  findAll(@CurrentUser() user: any) {
    return this.clientsService.findAll(user.id, user.role, user.organizationId);
  }

  @Get(':id')
  @Permissions('clients:view')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.findOne(id, user.id, user.role, user.organizationId);
  }

  @Post()
  @Permissions('clients:create')
  create(@Body() createClientDto: CreateClientDto, @CurrentUser() user: any) {
    return this.clientsService.create(
      { ...createClientDto, organizationId: user.organizationId },
      user?.id,
    );
  }

  @Patch(':id')
  @Permissions('clients:edit')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @CurrentUser() user: any) {
    return this.clientsService.update(id, updateClientDto, user?.id, user.organizationId);
  }

  @Delete(':id')
  @Permissions('clients:delete')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.remove(id, user?.id, user.organizationId);
  }

  @Post(':id/health')
  @Permissions('clients:health')
  generateHealthReport(
    @Param('id') id: string,
    @Body() body: { provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.clientsService.generateHealthReport(id, body.provider, user.organizationId);
  }

  @Post(':id/upsell')
  @Permissions('clients:upsell')
  generateUpsellStrategy(
    @Param('id') id: string,
    @Body() body: { provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.clientsService.generateUpsellStrategy(id, body.provider, user.organizationId);
  }

  @Post(':id/health/auto-update')
  @Permissions('clients:health')
  updateHealthStatus(
    @Param('id') id: string,
    @Body() body: { provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.clientsService.updateHealthStatus(id, body.provider, user.organizationId);
  }

  @Post(':id/health/override')
  @Permissions('clients:health')
  overrideHealthStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.clientsService.overrideHealthStatus(
      id,
      body.status,
      body.reason,
      user.id,
      user.organizationId,
    );
  }

  @Post('convert-lead/:leadId')
  @Permissions('clients:convert')
  convertLead(
    @Param('leadId') leadId: string,
    @Body()
    body: {
      accountManagerId?: string;
      projectManagerId?: string;
      projectName?: string;
      contractedValue?: number;
      endOfProjectValue?: number;
      estimatedDueDate?: string;
      closedDate?: string;
      designerId?: string;
      qsId?: string;
      description?: string;
      status?: string;
    },
    @CurrentUser() user: any,
  ) {
    return this.clientsService.convertLeadToClient(
      leadId,
      body.accountManagerId,
      body.projectManagerId,
      {
        name: body.projectName,
        contractedValue: body.contractedValue,
        endOfProjectValue: body.endOfProjectValue,
        estimatedDueDate: body.estimatedDueDate,
        closedDate: body.closedDate,
        designerId: body.designerId,
        qsId: body.qsId,
        description: body.description,
        status: body.status,
      },
      user.organizationId,
    );
  }
}
