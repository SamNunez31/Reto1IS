import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/decorators';
import { DbService } from '../../database/db.service';

@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Estado de la app y de la BD (SELECT 1)' })
  async health(): Promise<{ status: string; app: string; db: string; timestamp: string }> {
    let db = 'up';
    try {
      await this.db.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degradado', app: 'up', db, timestamp: new Date().toISOString() };
  }
}
