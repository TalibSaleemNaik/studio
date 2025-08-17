
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Board {
  id: string;
  name: string;
  description: string;
}

function CreateBoardDialog({ workspaceId, onBoardCreated, children }: { workspaceId: string, onBoardCreated: () => void, children: React.ReactNode }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleCreateBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Title is required' });
            return;
        }
        setIsCreating(true);
        try {
            // Add the board
            const boardRef = await addDoc(collection(db, `workspaces/${workspaceId}/boards`), {
                name: title,
                description: description,
                createdAt: serverTimestamp(),
            });
            
            // Add default groups/columns for the new board
            const defaultGroups = ['To Do', 'In Progress', 'Done'];
            for (let i = 0; i < defaultGroups.length; i++) {
                await addDoc(collection(db, `workspaces/${workspaceId}/groups`), {
                    boardId: boardRef.id,
                    name: defaultGroups[i],
                    order: i,
                });
            }

            toast({ title: "Board created successfully!" });
            setTitle('');
            setDescription('');
            setIsOpen(false); // Close dialog on success
            onBoardCreated(); // Callback to parent
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create board", description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateBoard}>
                    <DialogHeader>
                        <DialogTitle>Create New Board</DialogTitle>
                        <DialogDescription>
                            Give your new board a title and description.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q4 Roadmap" className="col-span-3" disabled={isCreating} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the board's purpose." className="col-span-3" disabled={isCreating} />
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


export default function DashboardPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const hardcodedWorkspaceId = 'default-workspace';

  useEffect(() => {
    if (!user) {
      setLoading(true); // Keep loading if no user
      return;
    }

    const workspaceRef = doc(db, 'workspaces', hardcodedWorkspaceId);

    const setupAndFetch = async () => {
        try {
            const workspaceSnap = await getDoc(workspaceRef);
            if (!workspaceSnap.exists()) {
                await setDoc(workspaceRef, { name: "Default Workspace", ownerId: user.uid });
            }
            setWorkspaceId(hardcodedWorkspaceId);
            
            const boardsQuery = query(collection(db, `workspaces/${hardcodedWorkspaceId}/boards`));
            const unsubscribe = onSnapshot(boardsQuery, 
                (querySnapshot) => {
                    const boardsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
                    setBoards(boardsData);
                    setError(null);
                    setLoading(false);
                },
                (err) => {
                    console.error("Error fetching boards:", err);
                    setError("Failed to fetch boards. Please check your connection and try again.");
                    toast({ variant: 'destructive', title: 'Error fetching boards', description: err.message });
                    setLoading(false);
                }
            );
            return unsubscribe;

        } catch (err: any) {
            console.error("Error setting up workspace or fetching data:", err);
            setError("Could not connect to the database. Some features may not be available.");
            toast({ variant: 'destructive', title: 'Database Connection Error', description: err.message });
            setLoading(false);
        }
    };

    const unsubscribePromise = setupAndFetch();

    return () => {
        unsubscribePromise.then(unsubscribe => {
            if (unsubscribe) {
                unsubscribe();
            }
        });
    }

  }, [user, toast]);


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
          <p className="text-muted-foreground">An overview of your projects and workspaces.</p>
        </div>
        {workspaceId && 
            <CreateBoardDialog workspaceId={workspaceId} onBoardCreated={() => {}}>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Board
                </Button>
            </CreateBoardDialog>
        }
      </div>

      <div>
        <h2 className="text-2xl font-headline font-semibold mb-4">My Boards</h2>
        {loading ? (
             <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
             </div>
        ) : error ? (
            <div className="text-destructive text-center p-4 bg-destructive/10 rounded-md">{error}</div>
        ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boards.map((board) => (
                <Card key={board.id} className="hover:shadow-md transition-shadow">
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
                    <CardDescription>{board.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between items-center">
                    <div className="flex -space-x-2 overflow-hidden">
                    {/* Placeholder for members */}
                    <Avatar>
                        <AvatarFallback>+?</AvatarFallback>
                    </Avatar>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                    <Link href={`/board/${board.id}`}>View Board</Link>
                    </Button>
                </CardFooter>
                </Card>
            ))}
            {workspaceId &&
                 <CreateBoardDialog workspaceId={workspaceId} onBoardCreated={() => {}}>
                    <Card className="flex items-center justify-center border-dashed hover:border-primary hover:text-primary transition-colors cursor-pointer">
                        <CardContent className="p-6 text-center">
                            <div className="flex flex-col h-auto gap-2 items-center">
                            <PlusCircle className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm font-medium">New Board</span>
                            </div>
                        </CardContent>
                    </Card>
                </CreateBoardDialog>
            }
            </div>
        )}
      </div>
    </div>
  )
}
