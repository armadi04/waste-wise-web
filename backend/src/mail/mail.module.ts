import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from './mail.service';
import { MailOutboxService } from './mail-outbox.service';
import { OutboundEmail } from './entities/outbound-email.entity';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([OutboundEmail])],
  providers: [MailService, MailOutboxService],
  exports: [MailService, MailOutboxService],
})
export class MailModule {}
