
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
}

export interface Column {
  id: string;
  name: string;
  items: Task[];
  order: number;
}

export interface Columns {
  [key: string]: Column;
}

export interface UserProfile {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
}

export interface BoardMember extends UserProfile {
  role: 'owner' | 'editor' | 'viewer';
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  createdAt: any; // Firestore Timestamp
}
