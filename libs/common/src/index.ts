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
  
  // ========== DTOs ==========
  export interface UserData {
    name: string;
    link: string;
    meta?: Record<string, any>;
  }
  
  export interface UserPreference {
    email: boolean;
    push: boolean;
  }
  
  export interface CreateNotificationDto {
    notification_type: NotificationType;
    user_id: string;
    template_code: string;
    variables: UserData;
    request_id: string;
    priority: number;
    metadata?: Record<string, any>;
  }
  
  export interface CreateUserDto {
    name: string;
    email: string;
    push_token?: string;
    preferences: UserPreference;
    password: string;
  }
  
  export interface NotificationStatusDto {
    notification_id: string;
    status: NotificationStatus;
    timestamp?: Date;
    error?: string;
  }
  
  // ========== QUEUE MESSAGE TYPES ==========
  export interface EmailQueueMessage {
    notification_id: string;
    user_id: string;
    email: string;
    template_code: string;
    variables: Record<string, any>;
    request_id: string;
    retry_count?: number;
  }
  
  export interface PushQueueMessage {
    notification_id: string;
    user_id: string;
    push_token: string;
    template_code: string;
    variables: Record<string, any>;
    request_id: string;
    retry_count?: number;
  }
  
  // ========== CONSTANTS ==========
  export const QUEUE_NAMES = {
    EMAIL: 'email.queue',
    PUSH: 'push.queue',
    FAILED: 'failed.queue',
  };
  
  export const EXCHANGE_NAME = 'notifications.direct';