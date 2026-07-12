export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  preferences?: string[];
  createdAt: string;
}

export interface Video {
  id: string;
  videoUrl: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  description: string;
  category: string;
  songName: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  mimeType?: string;
  // Video editing properties (crop, zoom, styling)
  cropRatio?: '9:16' | '16:9' | '1:1' | 'none';
  zoomScale?: number; // 1.0 to 2.0
  translateY?: number; // -100 to 100 pixels
  visualFilter?: 'none' | 'grayscale' | 'sepia' | 'contrast' | 'invert' | 'blur';
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export interface Follow {
  id: string; // followerId_followingId
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageSenderId: string;
  lastMessageAt: string;
  unreadBy: string[];
  // Loaded dynamically
  otherUser?: UserProfile;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  senderId: string;
  senderName: string;
  senderAvatar: string;
  targetId: string; // videoId or chatId or followId
  text: string;
  read: boolean;
  createdAt: string;
}

export type DarkThemeType = 'onyx' | 'nordic' | 'cosmic' | 'emerald';

export interface ThemeConfig {
  id: DarkThemeType;
  name: string;
  background: string;
  card: string;
  primary: string;
  accent: string;
  text: string;
  textSecondary: string;
}

export const THEMES: Record<DarkThemeType, ThemeConfig> = {
  onyx: {
    id: 'onyx',
    name: 'Onyx Midnight',
    background: 'bg-[#000000]',
    card: 'bg-[#121212]',
    primary: 'text-[#FE2C55] bg-[#FE2C55]', // TikTok red
    accent: '#FE2C55',
    text: 'text-white',
    textSecondary: 'text-gray-400'
  },
  nordic: {
    id: 'nordic',
    name: 'Nordic Night',
    background: 'bg-[#0F172A]', // Slate 900
    card: 'bg-[#1E293B]', // Slate 800
    primary: 'text-[#38BDF8] bg-[#38BDF8]', // Sky 400
    accent: '#38BDF8',
    text: 'text-[#F1F5F9]', // Slate 100
    textSecondary: 'text-slate-400'
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Purple',
    background: 'bg-[#0B0114]', // Very dark purple
    card: 'bg-[#1A0A2D]', // Deep violet
    primary: 'text-[#C084FC] bg-[#C084FC]', // Purple 400
    accent: '#C084FC',
    text: 'text-[#FAF5FF]', // Purple 50
    textSecondary: 'text-[#D8B4FE]' // Purple 300
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Forest',
    background: 'bg-[#022C22]', // Teal 950
    card: 'bg-[#064E3B]', // Teal 900
    primary: 'text-[#34D399] bg-[#34D399]', // Emerald 400
    accent: '#34D399',
    text: 'text-[#F0FDF4]', // Green 50
    textSecondary: 'text-emerald-300'
  }
};
