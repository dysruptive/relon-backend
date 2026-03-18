import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // --- Client-scoped contact endpoints ---

  @Get('clients/:clientId/contacts')
  @Permissions('clients:view')
  findByClient(
    @Param('clientId') clientId: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.findByClient(clientId, user.organizationId);
  }

  @Post('clients/:clientId/contacts')
  @Permissions('clients:edit')
  createForClient(
    @Param('clientId') clientId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.create(clientId, dto, user.organizationId);
  }

  // --- Lead-scoped contact endpoints ---

  @Get('leads/:leadId/contacts')
  @Permissions('leads:view')
  findByLead(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.findByLead(leadId, user.organizationId);
  }

  @Post('leads/:leadId/contacts/:contactId')
  @Permissions('leads:edit')
  @HttpCode(HttpStatus.OK)
  linkToLead(
    @Param('leadId') leadId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.linkToLead(leadId, contactId, user.organizationId);
  }

  @Delete('leads/:leadId/contacts/:contactId')
  @Permissions('leads:edit')
  @HttpCode(HttpStatus.OK)
  unlinkFromLead(
    @Param('leadId') leadId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.unlinkFromLead(leadId, contactId, user.organizationId);
  }

  // --- Individual contact endpoints ---

  @Get('contacts/:id')
  @Permissions('clients:view')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.findOne(id, user.organizationId);
  }

  @Patch('contacts/:id')
  @Permissions('clients:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.update(id, dto, user.organizationId);
  }

  @Delete('contacts/:id')
  @Permissions('clients:edit')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.contactsService.remove(id, user.organizationId);
  }
}
