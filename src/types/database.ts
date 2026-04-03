export type Role = 'user' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  post_type: 'status' | 'blog';
  media_url: string | null;
  created_at: string;
  author?: UserProfile;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: UserProfile;
}

export interface AnonymousMessage {
  id: string;
  recipient_id: string;
  content: string;
  sender_id: string | null;
  sender_ip: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  image_url: string | null;
  is_group: boolean;
  created_at: string;
  last_message?: Message;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: UserProfile;
}

export interface ChatParticipant {
  room_id: string;
  user_id: string;
  user?: UserProfile;
}
