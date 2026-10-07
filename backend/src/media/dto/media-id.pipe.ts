import { BadRequestException, PipeTransform } from '@nestjs/common';
import { parseDatabaseId } from '@/common/utils/database-id';

export class MediaIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = parseDatabaseId(value);
    if (id === undefined)
      throw new BadRequestException('A positive database ID is required');
    return id;
  }
}
