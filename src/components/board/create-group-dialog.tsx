
'use client';

import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { logActivity, SimpleUser } from '@/lib/activity-logger';

export function CreateGroupDialog({ workpanelId, boardId, columnCount }: { workpanelId: string, boardId: string, columnCount: number }) {
    const [name, setName] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) {
            toast({ variant: 'destructive', title: 'List name cannot be empty' });
            return;
        }
        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workpanelId}/boards/${boardId}/groups`), {
                name: name,
                order: columnCount,
                createdAt: serverTimestamp(),
            });

            if (user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `created list "${name}"`);
            }

            toast({ title: "List created successfully!" });
            setName('');
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create list", description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" /> Add column
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateGroup}>
                    <DialogHeader>
                        <DialogTitle>Create New List</DialogTitle>
                        <DialogDescription>
                            Give your new list a name.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backlog" className="col-span-3" disabled={isCreating} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create List'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

    