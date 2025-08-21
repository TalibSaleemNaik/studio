
'use server';

import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * A simplified user object to prevent circular dependencies.
 */
export interface SimpleUser {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
}

/**
 * Logs an activity to the board's activity subcollection.
 * @param workspaceId The ID of the workspace.
 * @param boardId The ID of the board.
 * @param user The simplified user object of the user performing the action.
 * @param message The activity message to log.
 * @param taskId Optional ID of the task related to the activity.
 */
export async function logActivity(
    workspaceId: string,
    boardId: string,
    user: SimpleUser,
    message: string,
    taskId?: string
) {
    if (!user) {
        console.error("Cannot log activity: user is not authenticated.");
        return;
    }

    try {
        const activityCollectionRef = collection(db, `workspaces/${workspaceId}/boards/${boardId}/activity`);
        await addDoc(activityCollectionRef, {
            message,
            taskId,
            authorId: user.uid,
            authorName: user.displayName || 'Anonymous User',
            authorPhotoURL: user.photoURL || '',
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
        // Depending on requirements, you might want to handle this more gracefully
        // For now, we'll just log the error to the console.
    }
}
