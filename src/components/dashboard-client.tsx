
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2, AlertTriangle, Trash2, User, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch, where, getDocs, deleteDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";
import { logActivity, SimpleUser } from "@/lib/activity-logger";
import { UserProfile, Board as BoardType, WorkpanelRole } from "./board/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Checkbox } from "./ui/checkbox";

interface Board extends BoardType {
  id: string;
}

interface Workpanel {
    members: { [key: string]: WorkpanelRole };
}

function CreateBoardDialog({ workpanelId, onBoardCreated }: { workpanelId: string, onBoardCreated: () => void }) {
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
            
            const boardMembers = { [user.uid]: 'owner' };

            batch.set(boardRef, {
                name: title,
                description: description,
                createdAt: serverTimestamp(),
                ownerId: user.uid,
                members: boardMembers,
                isPrivate: isPrivate,
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
                                Make this board private
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

function BoardCard({ board, workpanelId, boardMembers, openDeleteDialog, canDelete }: { board: Board, workpanelId: string, boardMembers: UserProfile[], openDeleteDialog: (board: Board) => void, canDelete: boolean }) {
    const owner = boardMembers.find(m => m.uid === board.ownerId);

    return (
        <Card className="hover:shadow-md transition-shadow flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                         {board.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" />}
                         <CardTitle className="font-headline">{board.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Archive</DropdownMenuItem>
                            {canDelete && (
                                <DropdownMenuItem onSelect={() => openDeleteDialog(board)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2 h-10">{board.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center mt-auto">
                <TooltipProvider>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                            {boardMembers.slice(0, 3).map(member => (
                                <Tooltip key={member.uid}>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>{member.displayName}</TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                        {owner && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{owner.displayName}</span>
                            </div>
                        )}
                    </div>
                </TooltipProvider>
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/board/${board.id}?workpanelId=${workpanelId}`}>View Board</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}

export function DashboardClient({ workpanelId }: { workpanelId: string }) {
    const [boards, setBoards] = useState<Board[]>([]);
    const [workpanel, setWorkpanel] = useState<Workpanel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const [allUsers, setAllUsers] = useState<Map<string, UserProfile>>(new Map());

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!user) {
            setLoading(true);
            return;
        }

        const workpanelRef = doc(db, `workspaces/${workpanelId}`);
        const unsubscribeWorkpanel = onSnapshot(workpanelRef, async (workspaceSnap) => {
            if (!workspaceSnap.exists() || !workspaceSnap.data()?.members?.[user.uid]) {
                setError("You do not have permission to view this workpanel.");
                setLoading(false);
                return;
            }

            setWorkpanel(workspaceSnap.data() as Workpanel);
            
            const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`));
            const unsubscribeBoards = onSnapshot(boardsQuery, async (querySnapshot) => {
                const boardsData = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Board))
                    .filter(board => {
                        // Show board if it's not private, OR if it is private and the user is a member.
                        if (!board.isPrivate) return true;
                        return board.members && board.members[user.uid];
                    });

                setBoards(boardsData);

                const memberIds = new Set<string>();
                boardsData.forEach(board => {
                    Object.keys(board.members).forEach(uid => memberIds.add(uid));
                });

                const newUsers = new Map(allUsers);
                const usersToFetch = Array.from(memberIds).filter(uid => !newUsers.has(uid));
                
                if (usersToFetch.length > 0) {
                    const userDocs = await Promise.all(usersToFetch.map(uid => getDoc(doc(db, 'users', uid))));
                    userDocs.forEach(userDoc => {
                        if (userDoc.exists()) {
                            newUsers.set(userDoc.id, userDoc.data() as UserProfile);
                        }
                    });
                    setAllUsers(newUsers);
                }

                setError(null);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching boards:", err);
                setError("Failed to load boards. Please check your permissions and try again.");
                setLoading(false);
            });

            return () => unsubscribeBoards();
        }, (err) => {
            console.error("Error fetching workpanel:", err);
            setError("Failed to load workpanel data.");
            setLoading(false);
        });

        return () => unsubscribeWorkpanel();
    }, [user, workpanelId, allUsers]);

    const openDeleteDialog = (board: Board) => {
        setBoardToDelete(board);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteBoard = async () => {
        if (!boardToDelete || !user) return;
        setIsDeleting(true);

        try {
            const batch = writeBatch(db);

            const tasksRef = collection(db, `workspaces/${workpanelId}/boards/${boardToDelete.id}/tasks`);
            const tasksSnap = await getDocs(tasksRef);
            tasksSnap.docs.forEach(doc => batch.delete(doc.ref));

            const groupsRef = collection(db, `workspaces/${workpanelId}/boards/${boardToDelete.id}/groups`);
            const groupsSnap = await getDocs(groupsRef);
            groupsSnap.docs.forEach(doc => batch.delete(doc.ref));

            const activityRef = collection(db, `workspaces/${workpanelId}/boards/${boardToDelete.id}/activity`);
            const activitySnap = await getDocs(activityRef);
            activitySnap.docs.forEach(doc => batch.delete(doc.ref));

            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardToDelete.id);
            batch.delete(boardRef);

            await batch.commit();

            toast({ title: "Board deleted", description: `The board "${boardToDelete.name}" and all its contents have been deleted.` });
        } catch (error) {
            console.error("Error deleting board: ", error);
            toast({ variant: 'destructive', title: 'Error deleting board', description: 'Could not delete the board. Please try again.' });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setBoardToDelete(null);
        }
    };


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

    const currentUserRole = user && workpanel ? workpanel.members[user.uid] : undefined;
    const canCreateBoards = currentUserRole === 'admin' || currentUserRole === 'manager';

    return (
        <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {boards.map((board) => {
                    const boardMembers = Object.keys(board.members)
                        .map(uid => allUsers.get(uid))
                        .filter((u): u is UserProfile => !!u);
                    
                    const canDelete = currentUserRole === 'admin' || (user?.uid === board.ownerId);

                    return (
                        <BoardCard
                            key={board.id}
                            board={board}
                            workpanelId={workpanelId}
                            boardMembers={boardMembers}
                            openDeleteDialog={openDeleteDialog}
                            canDelete={canDelete}
                        />
                    );
                })}
                {canCreateBoards && (
                    <CreateBoardDialog workpanelId={workpanelId} onBoardCreated={() => { /* Data will refetch via snapshot listener */ }} />
                )}
            </div>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the board
                            <span className="font-semibold"> {boardToDelete?.name} </span>
                            and all of its tasks and lists.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBoard} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

    
