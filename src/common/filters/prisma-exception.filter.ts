import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': {
        const fields = (exception.meta?.target as string[])?.join(', ') ?? 'field';
        status = HttpStatus.CONFLICT;
        message = `A record with this ${fields} already exists`;
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Related record not found';
        break;
      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message = 'Relation violation — required relation missing';
        break;
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
    }

    response.status(status).json({ statusCode: status, message });
  }
}
