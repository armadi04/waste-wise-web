/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum NotificationType {
    info = "info",
    success = "success",
    warning = "warning",
    error = "error"
}

export interface PaginationInput {
    page?: Nullable<number>;
    limit?: Nullable<number>;
    search?: Nullable<string>;
    sort?: Nullable<string>;
    direction?: Nullable<string>;
}

export interface CreateInvitationInput {
    email: string;
    roleIds?: Nullable<number[]>;
}

export interface CreatePermissionInput {
    name: string;
    description?: Nullable<string>;
}

export interface UpdatePermissionInput {
    name?: Nullable<string>;
    description?: Nullable<string>;
}

export interface CreateRoleInput {
    name: string;
    description?: Nullable<string>;
    permissions?: Nullable<number[]>;
}

export interface UpdateRoleInput {
    name?: Nullable<string>;
    description?: Nullable<string>;
    permissions?: Nullable<number[]>;
}

export interface UpdateUserInput {
    email?: Nullable<string>;
    password?: Nullable<string>;
    fullname?: Nullable<string>;
    phone?: Nullable<string>;
    avatarId?: Nullable<number>;
    roleIds?: Nullable<number[]>;
    permissionIds?: Nullable<number[]>;
}

export interface PaginationMeta {
    __typename?: 'PaginationMeta';
    total: number;
    page: number;
    lastPage: number;
}

export interface IQuery {
    __typename?: 'IQuery';
    _health(): string | Promise<string>;
    invitations(pagination?: Nullable<PaginationInput>): InvitationConnection | Promise<InvitationConnection>;
    media(pagination?: Nullable<PaginationInput>): MediaConnection | Promise<MediaConnection>;
    mediaItem(id: number): Media | Promise<Media>;
    myNotifications(pagination?: Nullable<PaginationInput>): NotificationConnection | Promise<NotificationConnection>;
    unreadNotificationsCount(): number | Promise<number>;
    permissions(pagination?: Nullable<PaginationInput>): PermissionConnection | Promise<PermissionConnection>;
    permission(id: number): Permission | Promise<Permission>;
    roles(pagination?: Nullable<PaginationInput>): RoleConnection | Promise<RoleConnection>;
    role(id: number): Role | Promise<Role>;
    users(pagination?: Nullable<PaginationInput>): UserConnection | Promise<UserConnection>;
    user(id: number): User | Promise<User>;
}

export interface IMutation {
    __typename?: 'IMutation';
    _noop(): string | Promise<string>;
    createInvitation(input: CreateInvitationInput): CreateInvitationResult | Promise<CreateInvitationResult>;
    resendInvitation(id: number): Invitation | Promise<Invitation>;
    revokeInvitation(id: number): boolean | Promise<boolean>;
    deleteMedia(id: number): boolean | Promise<boolean>;
    markNotificationRead(id: number): Notification | Promise<Notification>;
    markAllNotificationsRead(): number | Promise<number>;
    createPermission(input: CreatePermissionInput): Permission | Promise<Permission>;
    updatePermission(id: number, input: UpdatePermissionInput): Permission | Promise<Permission>;
    deletePermission(id: number): boolean | Promise<boolean>;
    createRole(input: CreateRoleInput): Role | Promise<Role>;
    updateRole(id: number, input: UpdateRoleInput): Role | Promise<Role>;
    deleteRole(id: number): boolean | Promise<boolean>;
    syncRolePermissions(id: number, permissionIds: number[]): Role | Promise<Role>;
    attachRolePermissions(id: number, permissionIds: number[]): Role | Promise<Role>;
    detachRolePermissions(id: number, permissionIds: number[]): Role | Promise<Role>;
    updateUser(id: number, input: UpdateUserInput): User | Promise<User>;
    deleteUser(id: number): boolean | Promise<boolean>;
    syncUserRoles(id: number, roleIds: number[]): User | Promise<User>;
    attachUserRoles(id: number, roleIds: number[]): User | Promise<User>;
    detachUserRoles(id: number, roleIds: number[]): User | Promise<User>;
    syncUserPermissions(id: number, permissionIds: number[]): User | Promise<User>;
    attachUserPermissions(id: number, permissionIds: number[]): User | Promise<User>;
    detachUserPermissions(id: number, permissionIds: number[]): User | Promise<User>;
}

export interface Invitation {
    __typename?: 'Invitation';
    id: number;
    email: string;
    roleIds?: Nullable<number[]>;
    invitedBy?: Nullable<number>;
    expiresAt: DateTime;
    acceptedAt?: Nullable<DateTime>;
    createdAt: DateTime;
}

export interface InvitationConnection {
    __typename?: 'InvitationConnection';
    data: Invitation[];
    meta: PaginationMeta;
}

export interface CreateInvitationResult {
    __typename?: 'CreateInvitationResult';
    invitation: Invitation;
    inviteUrl: string;
}

export interface Media {
    __typename?: 'Media';
    id: number;
    filename: string;
    originalName?: Nullable<string>;
    mimetype: string;
    size?: Nullable<number>;
    url?: Nullable<string>;
    isPrivate: boolean;
    userId?: Nullable<number>;
    user?: Nullable<User>;
    createdAt: DateTime;
    updatedAt: DateTime;
}

export interface MediaConnection {
    __typename?: 'MediaConnection';
    data: Media[];
    meta: PaginationMeta;
}

export interface Notification {
    __typename?: 'Notification';
    id: number;
    userId?: Nullable<number>;
    user?: Nullable<User>;
    targetRole?: Nullable<string>;
    actorId?: Nullable<number>;
    title: string;
    message: string;
    type: NotificationType;
    isRead: boolean;
    link?: Nullable<string>;
    createdAt: DateTime;
}

export interface NotificationConnection {
    __typename?: 'NotificationConnection';
    data: Notification[];
    meta: PaginationMeta;
}

export interface Permission {
    __typename?: 'Permission';
    id: number;
    name: string;
    description?: Nullable<string>;
    createdAt: DateTime;
    updatedAt: DateTime;
}

export interface PermissionConnection {
    __typename?: 'PermissionConnection';
    data: Permission[];
    meta: PaginationMeta;
}

export interface Role {
    __typename?: 'Role';
    id: number;
    name: string;
    description?: Nullable<string>;
    permissions: Permission[];
    createdAt: DateTime;
    updatedAt: DateTime;
}

export interface RoleConnection {
    __typename?: 'RoleConnection';
    data: Role[];
    meta: PaginationMeta;
}

export interface User {
    __typename?: 'User';
    id: number;
    email: string;
    fullname?: Nullable<string>;
    phone?: Nullable<string>;
    avatar?: Nullable<Media>;
    roles: Role[];
    permissions: Permission[];
    emailVerifiedAt?: Nullable<DateTime>;
    createdAt: DateTime;
    updatedAt: DateTime;
}

export interface UserConnection {
    __typename?: 'UserConnection';
    data: User[];
    meta: PaginationMeta;
}

export type DateTime = any;
type Nullable<T> = T | null;
