
'use server';

import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface NotificationInput {
    recipientId: string;
    message: string;
    link: string;
}

/**
 * Creates a notification for a specific user.
 * @param notification - The notification data.
 */
export async function createNotification(notification: NotificationInput): Promise<void> {
    if (!notification.recipientId) {
        console.error("Cannot create notification: recipientId is missing.");
        return;
    }

    try {
        const notificationsCollectionRef = collection(db, `users/${notification.recipientId}/notifications`);
        await addDoc(notificationsCollectionRef, {
            message: notification.message,
            link: notification.link,
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

    