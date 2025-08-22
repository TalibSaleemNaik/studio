
export interface Attachment {
  id: string;
  name: string;
  url: string;
  path: string; // Full path in Firebase Storage
  type: string;
  createdAt: any;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  content: string;
  order: number;
  groupId: string;
  description?: string;
  dueDate?: any; // Firestore timestamp or JS Date
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  assignees?: string[]; // Array of user UIDs
  comments?: Comment[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
}

export interface Column {
  id: string;
  name: string;
  items: Task[];
  order: number;
}

export interface Columns {
  [key:string]: Column;
}

export interface UserProfile {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
}

export type WorkpanelRole = 'admin' | 'manager' | 'member';
export type BoardRole = 'owner' | 'editor' | 'viewer';

export interface WorkpanelMember {
    uid: string;
    role: WorkpanelRole;
}

export interface BoardMember extends UserProfile {
  role: BoardRole;
}

export interface Board {
    id: string;
    name: string;
    description: string;
    ownerId: string;
    members: { [key: string]: BoardRole };
    isPrivate?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  createdAt: any; // Firestore Timestamp
}

export interface Activity {
    id: string;
    message: string;
    authorId: string;
    authorName: string;
    authorPhotoURL: string;
    taskId?: string;
    timestamp: any; // Firestore Timestamp
}

export interface Notification {
  id: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
}

    
