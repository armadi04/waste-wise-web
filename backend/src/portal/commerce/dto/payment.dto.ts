import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PayPortalOrderDto {
  @ApiProperty({ enum: ['va', 'coins'] })
  @IsIn(['va', 'coins'])
  paymentMethod: string;
}

export class PaymentMethodsResponseDto {
  @ApiProperty({
    enum: ['va', 'coins'],
    isArray: true,
    description:
      'Methods that can complete a payment now. VA is listed only while the sandbox is enabled.',
  })
  methods: Array<'va' | 'coins'>;
}
