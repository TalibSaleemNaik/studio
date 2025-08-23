
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Loader2, FolderPlus } from "lucide-react";

interface CreateTeamRoomDialogProps {
    workpanelId: string;
}

export function CreateTeamRoomDialog({ workpanelId }: CreateTeamRoomDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const { toast } = useToast();
    const { user } = useAuth();

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) {
            toast({ variant: 'destructive', title: 'TeamRoom name is required.' });
            return;
        }

        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workpanelId}/teamRooms`), {
                name,
                workpanelId,
                createdAt: serverTimestamp(),
                members: {}, // No direct members on creation
                memberUids: []
            });

            toast({ title: "TeamRoom created successfully!" });
            setIsOpen(false);
            setName('');
        } catch (error) {
            console.error("Failed to create TeamRoom:", error);
            toast({ variant: 'destructive', title: 'Failed to create TeamRoom' });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Create TeamRoom
                </Button>
            </DialogTrigger>
            <DialogContent>
                 <form onSubmit={handleAction}>
                    <DialogHeader>
                        <DialogTitle>Create New TeamRoom</DialogTitle>
                        <DialogDescription>
                            Give your new TeamRoom a name to organize your teamboards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                         <Label htmlFor="name">TeamRoom Name</Label>
                         <Input id="name" placeholder="e.g. Q4 Projects" required value={name} onChange={(e) => setName(e.target.value)} disabled={isCreating} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create TeamRoom'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
