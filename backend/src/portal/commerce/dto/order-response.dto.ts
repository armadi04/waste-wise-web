import {
  ORDER_ITEM_PRODUCT_TYPES,
  type OrderItemProductType,
} from '@/portal/commerce/order-item';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VirtualAccountResponseDto {
  @ApiProperty() bank: string;
  @ApiProperty() number: string;
  @ApiProperty() sandbox: boolean;
}

export class PortalOrderItemResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ORDER_ITEM_PRODUCT_TYPES })
  productType: OrderItemProductType;
  @ApiProperty({ type: 'integer', minimum: 1 }) quantity: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) unitPrice: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, nullable: true })
  unitIndex?: number | null;
  @ApiPropertyOptional() attendee?: string;
}

export class PortalOrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() publicId: string;
  @ApiProperty() title: string;
  @ApiProperty() meta: string;
  @ApiProperty() total: number;
  @ApiProperty() quantity: number;
  @ApiProperty({ type: String, nullable: true }) paymentState: string | null;
  @ApiProperty({ type: [String] }) attendees: string[];
  @ApiProperty({ type: [PortalOrderItemResponseDto] })
  items: PortalOrderItemResponseDto[];
  @ApiProperty() canRequestRefund: boolean;
  @ApiProperty() status: string;
  @ApiProperty() kind: string;
  @ApiProperty() subtotal: number;
  @ApiProperty() discount: number;
  @ApiProperty({ type: String, nullable: true }) promoCode: string | null;
  @ApiProperty({ type: String, nullable: true }) paymentMethod: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  paidAt: Date | null;
  @ApiProperty() cashbackAmount: number;
  @ApiProperty({ type: String, nullable: true }) paymentReference:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  paymentExpiresAt: Date | null;
  @ApiProperty({ type: VirtualAccountResponseDto, nullable: true })
  virtualAccount: VirtualAccountResponseDto | null;
  @ApiProperty() canSimulatePayment: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) refundStatus?:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) refundReason?:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  refundRequestedAt?: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  refundedAt?: Date | null;
}

export class OrderPageMetaResponseDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() lastPage: number;
}

export class PortalOrdersResponseDto {
  @ApiProperty({ type: [PortalOrderResponseDto] })
  data: PortalOrderResponseDto[];
  @ApiProperty({ type: OrderPageMetaResponseDto })
  meta: OrderPageMetaResponseDto;
}
