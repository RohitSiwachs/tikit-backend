import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ForbiddenException
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

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
  @ApiOperation({ summary: 'Get school details by ID' })
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update school info' })
  update(@Param('id') id: string, @Body() updateSchoolDto: UpdateSchoolDto, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.update(id, updateSchoolDto);
  }

  @Patch(':id/regenerate-code')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Regenerate school code' })
  regenerateCode(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.regenerateCode(id);
  }

  @Post(':id/upload-students')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Upload list of students' })
  uploadStudents(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.uploadStudents(id, body.students);
  }

  @Post(':id/upload-classes')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Upload list of classes' })
  uploadClasses(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.uploadClasses(id, body.classes);
  }

  @Post(':id/assign-cards')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Assign cards to selected student groups' })
  assignCards(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== id) {
      throw new ForbiddenException('You can only manage your own school');
    }
    return this.schoolsService.assignCards(id, body.cardId, body.classNames);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Delete a school' })
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(id);
  }
}

