
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2, AlertTriangle, Trash2, User, Lock, FolderPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch, where, getDocs, deleteDoc, getDoc, orderBy } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";
import { logActivity, SimpleUser } from "@/lib/activity-logger";
import { UserProfile, Board as BoardType, WorkpanelRole, Folder } from "./board/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Checkbox } from "./ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";


interface Board extends BoardType {
  id: string;
}

interface Workpanel {
    members: { [key: string]: WorkpanelRole };
}

function CreateFolderDialog({ workpanelId, onFolderCreated }: { workpanelId: string, onFolderCreated: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const { toast } = useToast();

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Folder name is required.' });
            return;
        }

        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workpanelId}/folders`), {
                name,
                workpanelId,
                createdAt: serverTimestamp(),
            });

            toast({ title: "Folder created successfully!" });
            setIsOpen(false);
            setName('');
            onFolderCreated();
        } catch (error) {
            console.error("Failed to create folder:", error);
            toast({ variant: 'destructive', title: 'Failed to create folder' });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Create Folder
                </Button>
            </DialogTrigger>
            <DialogContent>
                 <form onSubmit={handleAction}>
                    <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                        <DialogDescription>
                            Give your new folder a name to organize your teamboards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                         <Label htmlFor="name">Folder Name</Label>
                         <Input id="name" placeholder="e.g. Q4 Projects" required value={name} onChange={(e) => setName(e.target.value)} disabled={isCreating} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Folder'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


function CreateBoardDialog({ workpanelId, folderId, onBoardCreated }: { workpanelId: string, folderId: string, onBoardCreated: () => void }) {
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
                folderId: folderId,
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
    const [folders, setFolders] = useState<Folder[]>([]);
    const [boardsByFolder, setBoardsByFolder] = useState<{[key: string]: Board[]}>({});
    const [unassignedBoards, setUnassignedBoards] = useState<Board[]>([]);

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
        const unsubscribeWorkpanel = onSnapshot(workpanelRef, (workspaceSnap) => {
            if (!workspaceSnap.exists() || !workspaceSnap.data()?.members?.[user.uid]) {
                setError("You do not have permission to view this workpanel.");
                setLoading(false);
                return;
            }
            setWorkpanel(workspaceSnap.data() as Workpanel);

            // Fetch Folders
            const foldersQuery = query(collection(db, `workspaces/${workpanelId}/folders`), orderBy('createdAt'));
            const unsubscribeFolders = onSnapshot(foldersQuery, (foldersSnapshot) => {
                const foldersData = foldersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
                setFolders(foldersData);

                // Fetch Boards
                const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`));
                const unsubscribeBoards = onSnapshot(boardsQuery, async (boardsSnapshot) => {
                    const boardsData = boardsSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as Board))
                        .filter(board => !board.isPrivate || (board.members && board.members[user.uid]));
                    
                    const newBoardsByFolder: {[key: string]: Board[]} = {};
                    foldersData.forEach(folder => {
                        newBoardsByFolder[folder.id] = [];
                    });

                    const newUnassignedBoards: Board[] = [];

                    boardsData.forEach(board => {
                        if (board.folderId && newBoardsByFolder[board.folderId]) {
                            newBoardsByFolder[board.folderId].push(board);
                        } else {
                            newUnassignedBoards.push(board);
                        }
                    });

                    setBoardsByFolder(newBoardsByFolder);
                    setUnassignedBoards(newUnassignedBoards);

                    // User fetching logic remains the same
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
                });
                return () => unsubscribeBoards();
            });
            return () => unsubscribeFolders();
        }, (err) => {
            console.error("Error fetching workpanel:", err);
            setError("Failed to load workpanel data.");
            setLoading(false);
        });

        return () => unsubscribeWorkpanel();
    }, [user, workpanelId]);

    const openDeleteDialog = (board: Board) => {
        setBoardToDelete(board);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteBoard = async () => {
        if (!boardToDelete || !user) return;
        setIsDeleting(true);

        try {
            const batch = writeBatch(db);
            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardToDelete.id);
            batch.delete(boardRef);
            // Cascading deletes for subcollections should be handled by a backend function for robustness
            // For now, we just delete the board doc.
            await batch.commit();

            toast({ title: "Board deleted", description: `The board "${boardToDelete.name}" has been deleted.` });
        } catch (error) {
            console.error("Error deleting board: ", error);
            toast({ variant: 'destructive', title: 'Error deleting board' });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setBoardToDelete(null);
        }
    };


    if (loading) {
        return <Skeleton className="h-96 w-full" />;
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
    const canCreate = currentUserRole === 'admin' || currentUserRole === 'manager';

    const renderBoardGrid = (boards: Board[]) => {
        return boards.map((board) => {
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
        });
    };

    return (
        <>
            {canCreate && (
                <div className="mb-8">
                     <CreateFolderDialog workpanelId={workpanelId} onFolderCreated={() => {}} />
                </div>
            )}
            <Accordion type="multiple" defaultValue={folders.map(f => f.id)} className="w-full space-y-4">
                 {folders.map(folder => (
                    <AccordionItem value={folder.id} key={folder.id} className="border-none">
                         <AccordionTrigger className="text-xl font-headline font-semibold hover:no-underline -ml-4 px-4 py-2 rounded-md hover:bg-muted">
                            {folder.name}
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                             <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {renderBoardGrid(boardsByFolder[folder.id] || [])}
                                {canCreate && <CreateBoardDialog workpanelId={workpanelId} folderId={folder.id} onBoardCreated={() => {}} />}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
           
            {unassignedBoards.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xl font-headline font-semibold mb-4">Uncategorized Boards</h2>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {renderBoardGrid(unassignedBoards)}
                    </div>
                </div>
            )}
            
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
