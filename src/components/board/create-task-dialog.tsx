
'use client';

import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/lib/activity-logger';

export function CreateTaskDialog({ workspaceId, boardId, groupId, columnItemCount }: { workspaceId: string, boardId: string, groupId: string, columnItemCount: number }) {
    const [content, setContent] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !user) {
            toast({ variant: 'destructive', title: 'Task content cannot be empty' });
            return;
        }
        setIsCreating(true);
        try {
            const taskRef = await addDoc(collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`), {
                groupId: groupId,
                content: content,
                order: columnItemCount, // Add to the bottom of the list
                createdAt: serverTimestamp(),
            });

            await logActivity(workspaceId, boardId, user, `created task "${content}"`, taskRef.id);

            toast({ title: "Task created successfully!" });
            setContent('');
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create task", description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="ghost" className="w-full mt-2 justify-start">
                  <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateTask}>
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                            Add a new task to this column.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="content" className="text-right pt-2">
                                Task
                            </Label>
                            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. Design the login page" className="col-span-3" disabled={isCreating} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

    

    