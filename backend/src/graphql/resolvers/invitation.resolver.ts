import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { Permissions } from '@/auth/permissions.decorator';
import { InvitationsService } from '@/invitations/invitations.service';
import { CreateInvitationDto } from '@/invitations/dto/create-invitation.dto';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import type { PaginationInput } from '../generated/graphql';
import { paginationArgs } from '../helpers/pagination.util';

/**
 * GraphQL surface for admin invitation management. All operations require
 * `users.invite`, matching the REST controller. Accepting an invitation is a
 * public token flow that stays REST-only.
 */
@Resolver('Invitation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvitationResolver {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Query('invitations')
  @Permissions('users.invite')
  findAll(@Args('pagination') pagination?: PaginationInput) {
    return this.invitationsService.findAllPaginated(
      ...paginationArgs(pagination),
    );
  }

  @Mutation('createInvitation')
  @Permissions('users.invite')
  create(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateInvitationDto,
  ) {
    return this.invitationsService.createInvite(input, user);
  }

  @Mutation('resendInvitation')
  @Permissions('users.invite')
  resend(@Args('id') id: number) {
    return this.invitationsService.resend(id);
  }

  @Mutation('revokeInvitation')
  @Permissions('users.invite')
  async revoke(@Args('id') id: number): Promise<boolean> {
    await this.invitationsService.revoke(id);
    return true;
  }
}
