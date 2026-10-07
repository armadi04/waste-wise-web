import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { getRequest } from '@/common/helpers/execution-context.util';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class OwnerOrPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = getRequest(context);
    const user = request.user;
    // The resource id is a route param over REST and a resolver arg over
    // GraphQL; check both so the owner shortcut works on either transport.
    const paramId =
      context.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(context).getArgs<{ id?: number }>().id
        : request.params?.id;

    // Check if user is accessing their own resource
    if (paramId && user?.userId && +paramId === user.userId) {
      return true;
    }

    // Check if user has superadmin role
    if (user?.roles?.includes('superadmin')) {
      return true;
    }

    // If no permissions required, allow access
    if (!requiredPermissions) {
      return true;
    }

    // Check if user has required permissions
    return requiredPermissions.some((permission) =>
      user.permissions?.includes(permission),
    );
  }
}
