export const NotificationType = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_DUE: 'TASK_DUE',
  TASK_OVERDUE: 'TASK_OVERDUE',
  LEAD_STALE: 'LEAD_STALE',
  LEAD_STAGE_CHANGED: 'LEAD_STAGE_CHANGED',
  PROJECT_AT_RISK: 'PROJECT_AT_RISK',
  CLIENT_DORMANT: 'CLIENT_DORMANT',
  MENTION: 'MENTION',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationTypeKey =
  (typeof NotificationType)[keyof typeof NotificationType];
