import { Controller, Get, Patch, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get('me')
  getMyOrg(@CurrentUser() user: any) {
    return this.orgsService.findById(user.organizationId);
  }

  @Get('me/stats')
  getStats(@CurrentUser() user: any) {
    return this.orgsService.getStats(user.organizationId);
  }

  @Patch('me')
  updateMyOrg(
    @CurrentUser() user: any,
    @Body() body: { name?: string; industry?: string; size?: string; country?: string; currency?: string },
  ) {
    return this.orgsService.update(user.organizationId, body);
  }

  @Patch('onboarding')
  @Permissions('settings:manage')
  updateOnboarding(
    @CurrentUser() user: any,
    @Body() body: UpdateOnboardingDto,
  ) {
    return this.orgsService.updateOnboarding(user.organizationId, body.step);
  }

  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    },
  }))
  uploadLogo(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.orgsService.uploadLogo(user.organizationId, file);
  }

  @Post('seed-demo-data')
  seedDemoData(@CurrentUser() user: any) {
    return this.orgsService.seedDemoData(user.organizationId, user.sub);
  }
}
