
'use client';

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { logActivity, SimpleUser } from "@/lib/activity-logger";
import { PlusCircle, Loader2 } from "lucide-react";

interface CreateBoardDialogProps {
    workpanelId: string;
    teamRoomId: string;
    onBoardCreated: () => void;
}

export function CreateBoardDialog({ workpanelId, teamRoomId, onBoardCreated }: CreateBoardDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !user) {
            toast({ variant: 'destructive', title: 'Board title is required.' });
            return;
        }

        setIsCreating(true);
        try {
            const batch = writeBatch(db);
            const boardRef = doc(collection(db, `workspaces/${workpanelId}/boards`));
            
            const boardMembers = { [user.uid]: 'manager' };

            batch.set(boardRef, {
                name: title,
                description: description,
                createdAt: serverTimestamp(),
                ownerId: user.uid,
                members: boardMembers,
                memberUids: [user.uid],
                isPrivate: isPrivate,
                teamRoomId: teamRoomId,
                workpanelId: workpanelId,
            });

            const defaultGroups = ['To Do', 'In Progress', 'Done'];
            for (let i = 0; i < defaultGroups.length; i++) {
                const groupRef = doc(collection(db, `workspaces/${workpanelId}/boards/${boardRef.id}/groups`));
                batch.set(groupRef, {
                    name: defaultGroups[i],
                    order: i,
                });
            }
            
            await batch.commit();

            const simpleUser: SimpleUser = {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
            };
            await logActivity(workpanelId, boardRef.id, simpleUser, `created the board "${title}"`);

            toast({ title: "Board created successfully!" });
            setIsOpen(false);
            setTitle('');
            setDescription('');
            setIsPrivate(false);
            onBoardCreated();
        } catch (error) {
            console.error("Failed to create board:", error);
            toast({ variant: 'destructive', title: 'Failed to create board' });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Card className="flex items-center justify-center border-dashed hover:border-primary hover:text-primary transition-colors cursor-pointer min-h-[192px]">
                    <CardContent className="p-6 text-center">
                        <div className="flex flex-col h-auto gap-2 items-center">
                        <PlusCircle className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-medium">New Teamboard</span>
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAction}>
                    <DialogHeader>
                        <DialogTitle>Create New Teamboard</DialogTitle>
                        <DialogDescription>
                            Give your new teamboard a title and description.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input id="title" name="title" placeholder="e.g. Q4 Roadmap" className="col-span-3" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isCreating} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Textarea id="description" name="description" placeholder="Describe the board's purpose." className="col-span-3" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isCreating} />
                        </div>
                        <div className="flex items-center space-x-2 justify-end">
                            <Checkbox id="private" checked={isPrivate} onCheckedChange={(checked) => setIsPrivate(checked as boolean)} disabled={isCreating}/>
                            <Label htmlFor="private" className="text-sm font-normal text-muted-foreground">
                                Make this board private (invite only)
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Board'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
