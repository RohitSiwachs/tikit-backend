import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint to keep Render awake' })
  checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'TiKit Backend is up and running!',
    };
  }
}
