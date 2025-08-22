
'use client';

import React, { useState, useEffect } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from './types';
import { Skeleton } from '../ui/skeleton';

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

export function ActivityDrawer({
    workpanelId,
    boardId,
    isOpen,
    onOpenChange,
}: {
    workpanelId: string;
    boardId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        const activityQuery = query(
            collection(db, `workspaces/${workpanelId}/boards/${boardId}/activity`),
            orderBy('timestamp', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setActivities(activitiesData);
            setLoading(false);
        }, (error) => {
            console.error("Failed to fetch activities:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, workpanelId, boardId]);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full max-w-md flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Board Activity
                    </SheetTitle>
                    <SheetDescription>
                        A log of the most recent activities on this board.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto pr-4 -mr-4 mt-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center space-x-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-[250px]" />
                                        <Skeleton className="h-4 w-[200px]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="text-center text-muted-foreground pt-10">
                            No recent activity.
                        </div>
                    ) : (
                        <ul className="space-y-6">
                            {activities.map(activity => (
                                <li key={activity.id} className="flex gap-4">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={activity.authorPhotoURL} />
                                        <AvatarFallback>{activity.authorName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm">
                                            <span className="font-semibold">{activity.authorName}</span>
                                            {' '}
                                            {activity.message}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {activity.timestamp ? formatDistanceToNow(asJsDate(activity.timestamp), { addSuffix: true }) : '...'}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
