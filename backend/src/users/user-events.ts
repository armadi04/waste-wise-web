export interface UserStatusUpdatedEvent {
  actorId: number;
  actorEmail: string;
  targetId: number;
  targetEmail: string;
  isActive: boolean;
  ipAddress: string | null;
}
