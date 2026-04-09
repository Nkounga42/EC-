export type Role = 'user' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  created_at: string;
  last_seen_at?: string | null;
  certified?: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  title?: string | null;
  content: string;
  post_type: 'status' | 'blog';
  media_url: string | null;
  cover_image?: string | null;
  font_family?: string | null;
  background_color?: string | null;
  tags?: string[] | null;
  created_at: string;
  author?: UserProfile;
  likes_count?: number;
  comments_count?: number;
  views_count?: number;
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
  last_message_at?: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_id?: string | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
  sender?: UserProfile;
  reply_to?: Message;
}

export interface ChatParticipant {
  room_id: string;
  user_id: string;
  user?: UserProfile;
}

export interface StatusView {
  id: string;
  post_id: string;
  viewer_id: string;
  viewed_at: string;
  viewer?: UserProfile;
}
