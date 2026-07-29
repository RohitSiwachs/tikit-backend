import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  ForbiddenException,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '../prisma-enums';
import {
  UploadStudentsDto,
  UploadClassesDto,
  AssignCardsToSchoolDto,
} from './dto/school-actions.dto';
import { CreateClassDto, UpdateClassDto } from './dto/classes.dto';
import { BulkCreateSchoolsDto } from './dto/bulk-create-school.dto';
import {
  GenerateIndividualCodesDto,
  RedeemIndividualCodeDto,
} from './dto/invite-code.dto';

@ApiTags('schools')
@ApiBearerAuth()
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Create a new school (Admin only)' })
  create(@Body() createSchoolDto: CreateSchoolDto) {
    return this.schoolsService.create(createSchoolDto);
  }

  @Post('bulk')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({
    summary:
      'Bulk-create schools (Admin only). Validates every row, skips invalid/duplicate slugs, returns created/failed/errors.',
  })
  @ApiBody({ type: BulkCreateSchoolsDto })
  bulkCreate(@Body() body: BulkCreateSchoolsDto) {
    return this.schoolsService.bulkCreate(body.schools);
  }

  @Post('upload-csv')
  @Roles(Role.TIKIT_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Upload schools from a CSV file (TIKIT_ADMIN only). Creates school + admin user + communication allocation per row.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'CSV file. Required columns: name, slug, city, contactEmail. Optional: description, contactPhone, address',
        },
      },
      required: ['file'],
    },
  })
  async uploadSchoolsCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a multipart/form-data request with field name "file"',
      );
    }
    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      throw new BadRequestException('Only .csv files are accepted');
    }
    return this.schoolsService.uploadSchoolsCsv(file.buffer);
  }

  // Must be before /:id routes to avoid routing conflict
  @Post('redeem-individual-code')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary:
      'Redeem an individual invite code — links student to school (auto-approved)',
  })
  @ApiBody({ type: RedeemIndividualCodeDto })
  redeemIndividualCode(
    @Body() body: RedeemIndividualCodeDto,
    @Request() req: any,
  ) {
    return this.schoolsService.redeemIndividualCode(req.user.id, body.code);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'List all schools publicly with pagination and search',
  })
  findAllPublic(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schoolsService.findAll({
      search,
      city,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all schools with pagination and search' })
  findAll(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schoolsService.findAll({
      search,
      city,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get school details by ID. tempAdminPassword visible to TIKIT_ADMIN only.',
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.schoolsService.findOne(id, req.user?.role);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update school info' })
  update(
    @Param('id') id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.update(id, updateSchoolDto, req.user.role);
  }

  // ─── School Verification ─────────────────────────────────────────────────

  @Get(':id/verification')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get school verification status' })
  getVerificationStatus(@Param('id') id: string) {
    return this.schoolsService.getVerificationStatus(id);
  }

  @Post(':id/verify')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Verify a school (TIKIT_ADMIN only)' })
  verifySchool(@Param('id') id: string) {
    return this.schoolsService.verifySchool(id);
  }

  @Delete(':id/verify')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Remove school verification (TIKIT_ADMIN only)' })
  removeVerification(@Param('id') id: string) {
    return this.schoolsService.removeVerification(id);
  }

  // ─── Individual Invite Codes ───────────────────────────────────────────────

  @Post(':id/individual-codes')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Generate individual invite codes for a school (1–500)',
  })
  @ApiBody({ type: GenerateIndividualCodesDto })
  generateIndividualCodes(
    @Param('id') id: string,
    @Body() dto: GenerateIndividualCodesDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.generateIndividualCodes(id, dto);
  }

  @Get(':id/individual-codes')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'List individual invite codes for a school (paginated)',
  })
  listIndividualCodes(
    @Param('id') id: string,
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.listIndividualCodes(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post(':id/individual-codes/export')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Export all individual invite codes as a CSV download',
  })
  async exportIndividualCodes(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    const csv = await this.schoolsService.exportIndividualCodes(id);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="invite-codes-${id}.csv"`,
    });
    res.send(csv);
  }

  @Post(':id/upload-students')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Upload list of students' })
  @ApiBody({ type: UploadStudentsDto })
  uploadStudents(
    @Param('id') id: string,
    @Body() body: UploadStudentsDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.uploadStudents(id, body.students);
  }

  @Post(':id/upload-classes')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Upload list of classes' })
  @ApiBody({ type: UploadClassesDto })
  uploadClasses(
    @Param('id') id: string,
    @Body() body: UploadClassesDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.uploadClasses(id, body.classes);
  }

  @Post(':id/assign-cards')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Assign cards to selected student groups' })
  @ApiBody({ type: AssignCardsToSchoolDto })
  assignCards(
    @Param('id') id: string,
    @Body() body: AssignCardsToSchoolDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.assignCards(id, body.cardId, body.classNames);
  }

  // ─── Classes CRUD ─────────────────────────────────────────────────────────

  @Get(':id/public-classes')
  @Public()
  @ApiOperation({ summary: 'Get all classes for a school (Public)' })
  getPublicClasses(@Param('id') id: string) {
    return this.schoolsService.getPublicClasses(id);
  }

  @Get(':id/classes')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN, Role.STUDENT)
  @ApiOperation({ summary: 'Get all classes for a school, including students' })
  getClasses(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException(
        'You can only view classes for your own school',
      );
    }
    return this.schoolsService.getClasses(id);
  }

  @Post(':id/classes')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create a new class' })
  @ApiBody({ type: CreateClassDto })
  createClass(
    @Param('id') id: string,
    @Body() body: CreateClassDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.createClass(id, body);
  }

  @Patch(':id/classes/:classId')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update a class' })
  @ApiBody({ type: UpdateClassDto })
  updateClass(
    @Param('id') id: string,
    @Param('classId') classId: string,
    @Body() body: UpdateClassDto,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.updateClass(id, classId, body);
  }

  @Delete(':id/classes/:classId')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Delete a class' })
  deleteClass(
    @Param('id') id: string,
    @Param('classId') classId: string,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.deleteClass(id, classId);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Delete a school' })
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(id);
  }
}
