/** Tickets stay usable for check-in until 24 hours after the event starts. */
export const TICKET_USE_WINDOW_MS = 86_400_000;

export const isTicketWindowOpen = (startsAt: Date, now = Date.now()) =>
  startsAt.getTime() + TICKET_USE_WINDOW_MS > now;
