
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";

interface Board {
  id: string;
  name: string;
  description: string;
}

function CreateBoardDialog({ workspaceId, onBoardCreated }: { workspaceId: string, onBoardCreated: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
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
            const workspaceRef = doc(db, `workspaces/${workspaceId}`);
            const boardRef = doc(collection(db, `workspaces/${workspaceId}/boards`));
            
            const members = { [user.uid]: 'owner' };

            // Set board data
            batch.set(boardRef, {
                name: title,
                description: description,
                createdAt: serverTimestamp(),
                ownerId: user.uid,
                members: members
            });

            // IMPORTANT: Ensure user is also a member of the workspace
            batch.set(workspaceRef, {
                members: {
                    [user.uid]: 'owner'
                }
            }, { merge: true });


            const defaultGroups = ['To Do', 'In Progress', 'Done'];
            for (let i = 0; i < defaultGroups.length; i++) {
                const groupRef = doc(collection(db, `workspaces/${workspaceId}/groups`));
                batch.set(groupRef, {
                    boardId: boardRef.id,
                    name: defaultGroups[i],
                    order: i,
                });
            }
            
            await batch.commit();

            toast({ title: "Board created successfully!" });
            setIsOpen(false);
            setTitle('');
            setDescription('');
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
                        <span className="text-sm font-medium">New Board</span>
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAction}>
                    <DialogHeader>
                        <DialogTitle>Create New Board</DialogTitle>
                        <DialogDescription>
                            Give your new board a title and description. Three default lists (To Do, In Progress, Done) will be created for you.
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

export function DashboardClient({ workspaceId }: { workspaceId: string }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  const ensureWorkspaceExists = useCallback(async () => {
    if (!user || !workspaceId) return;
    try {
        const workspaceRef = doc(db, `workspaces/${workspaceId}`);
        await setDoc(workspaceRef, { 
            name: "Default Workspace", 
            ownerId: user.uid,
            members: { [user.uid]: 'owner' }
        }, { merge: true });
    } catch(e) {
        console.error("Error ensuring workspace exists:", e);
    }
  }, [workspaceId, user]);

  useEffect(() => {
    if (!user || !workspaceId) {
        setLoading(true);
        return;
    }

    setLoading(true);
    ensureWorkspaceExists();

    const boardsQuery = query(collection(db, `workspaces/${workspaceId}/boards`));
    const unsubscribe = onSnapshot(boardsQuery, (querySnapshot) => {
        const boardsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
        setBoards(boardsData);
        setLoading(false);
        setError(null);
    }, (err) => {
        console.error("Error fetching boards:", err);
        setError("Failed to load boards. Please check your connection and try again.");
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workspaceId, ensureWorkspaceExists]);

  if (loading) {
      return (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
      )
  }

  if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-semibold">Could not load dashboard data</p>
            <p className="text-muted-foreground">{error}</p>
        </div>
      )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards.map((board) => (
            <Card key={board.id} className="hover:shadow-md transition-shadow flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                <CardTitle className="font-headline">{board.name}</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Archive</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">{board.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center mt-auto">
                <div className="flex -space-x-2 overflow-hidden">
                    <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarFallback>+?</AvatarFallback>
                    </Avatar>
                </div>
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/board/${board.id}`}>View Board</Link>
                </Button>
            </CardFooter>
            </Card>
        ))}
        <CreateBoardDialog workspaceId={workspaceId} onBoardCreated={() => { /* Data will refetch via snapshot listener */ }} />
    </div>
  )
}

    