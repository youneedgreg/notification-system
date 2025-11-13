// ========== RESPONSE FORMATS ==========
export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  meta?: PaginationMeta;
}

// ========== ENUMS ==========
export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

// ========== NOTIFICATION STATUS INTERFACE ==========
export interface NotificationStatusData {
  notification_id: string;
  status: NotificationStatus;
  created_at: Date;
  updated_at?: Date;
  error?: string;
  retry_count?: number;
  user_id?: string;
  notification_type?: string;
}

// ========== CONSTANTS ==========
export const QUEUE_NAMES = {
  EMAIL: 'email.queue',
  PUSH: 'push.queue',
  FAILED: 'failed.queue',
};

export const EXCHANGE_NAME = 'notifications.direct';
