
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2, AlertTriangle, Trash2, User, Lock, FolderPlus, Move, GripVertical, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch, where, getDocs, deleteDoc, getDoc, orderBy, updateDoc, deleteField } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";
import { logActivity, SimpleUser } from "@/lib/activity-logger";
import { UserProfile, Board as BoardType, WorkpanelRole, Folder as FolderType, FolderRole } from "./board/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Checkbox } from "./ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";


interface Board extends BoardType {
  id: string;
}
interface Folder extends FolderType {
  id: string;
}

interface Workpanel {
    members: { [key: string]: WorkpanelRole };
}

function ShareFolderDialog({ workpanelId, folder, allUsers, onUpdate }: { workpanelId: string, folder: Folder, allUsers: Map<string, UserProfile>, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const { toast } = useToast();
    const folderMembers = folder.members || {};
    const folderMemberUids = Object.keys(folderMembers);

    const handleInvite = async () => {
        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            toast({ variant: 'destructive', title: 'Email is required.' });
            return;
        }
        setIsInviting(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', trimmedEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("User with that email not found.");
            }
            const userToInvite = querySnapshot.docs[0];
            if (folderMemberUids.includes(userToInvite.id)) {
                throw new Error("User is already a member of this folder.");
            }

            const folderRef = doc(db, `workspaces/${workpanelId}/folders`, folder.id);
            await updateDoc(folderRef, {
                [`members.${userToInvite.id}`]: 'editor' // Default role
            });
            toast({ title: "User invited to folder!" });
            setInviteEmail('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Invitation failed', description: error.message });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: FolderRole) => {
        try {
            const folderRef = doc(db, `workspaces/${workpanelId}/folders`, folder.id);
            await updateDoc(folderRef, { [`members.${memberId}`]: newRole });
            toast({ title: "Member role updated." });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            const folderRef = doc(db, `workspaces/${workpanelId}/folders`, folder.id);
            await updateDoc(folderRef, { [`members.${memberId}`]: deleteField() });
            toast({ title: "Member removed from folder." });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to remove member', description: error.message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share Folder: {folder.name}</DialogTitle>
                    <DialogDescription>
                        Invite people to this folder. They will get access to all teamboards inside it.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="flex space-x-2">
                        <Input
                            placeholder="Enter email to invite..."
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            disabled={isInviting}
                        />
                        <Button onClick={handleInvite} disabled={isInviting}>
                            {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Invite'}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium">People with access</h4>
                        {folderMemberUids.map(uid => {
                            const member = allUsers.get(uid);
                            return member ? (
                                <div key={uid} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.displayName}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={folderMembers[uid]}
                                            onValueChange={(value) => handleRoleChange(uid, value as FolderRole)}
                                        >
                                            <SelectTrigger className="w-[110px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="editor">Editor</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(uid)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : null;
                        })}
                         {folderMemberUids.length === 0 && <p className="text-sm text-muted-foreground">Only you have access to this folder.</p>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function CreateFolderDialog({ workpanelId }: { workpanelId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const { toast } = useToast();
    const { user } = useAuth();

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) {
            toast({ variant: 'destructive', title: 'Folder name is required.' });
            return;
        }

        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workpanelId}/folders`), {
                name,
                workpanelId,
                createdAt: serverTimestamp(),
                members: { [user.uid]: 'editor' } // Creator is editor by default
            });

            toast({ title: "Folder created successfully!" });
            setIsOpen(false);
            setName('');
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

function BoardCard({ board, workpanelId, folders, boardMembers, openDeleteDialog, handleMoveBoard, canDelete }: { board: Board, workpanelId: string, folders: Folder[], boardMembers: UserProfile[], openDeleteDialog: (board: Board) => void, handleMoveBoard: (boardId: string, newFolderId: string) => void, canDelete: boolean }) {
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
                             <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Move className="mr-2 h-4 w-4" />
                                    <span>Move to</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                     {folders.filter(f => f.id !== board.folderId).map(folder => (
                                         <DropdownMenuItem key={folder.id} onSelect={() => handleMoveBoard(board.id, folder.id)}>
                                             {folder.name}
                                         </DropdownMenuItem>
                                     ))}
                                     { board.folderId && 
                                        <DropdownMenuItem onSelect={() => handleMoveBoard(board.id, '')}>
                                            Uncategorized
                                        </DropdownMenuItem>
                                     }
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
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
            if (!workspaceSnap.exists()) {
                setError("You do not have permission to view this workpanel.");
                setLoading(false);
                return;
            }
            const workpanelData = workspaceSnap.data() as Workpanel;
             if (!workpanelData?.members?.[user.uid]) {
                setError("You are not a member of this workpanel.");
                setLoading(false);
                return;
            }
            setWorkpanel(workpanelData);
            
            // Fetch users in the workpanel
            const memberIds = Object.keys(workpanelData.members);
            if (memberIds.length > 0) {
                 const userDocs = await Promise.all(memberIds.map(uid => getDoc(doc(db, 'users', uid))));
                 const newAllUsers = new Map<string, UserProfile>();
                 userDocs.forEach(userDoc => {
                    if (userDoc.exists()) {
                        newAllUsers.set(userDoc.id, userDoc.data() as UserProfile);
                    }
                 });
                 setAllUsers(newAllUsers);
            }

            // Fetch Folders
            const foldersQuery = query(collection(db, `workspaces/${workpanelId}/folders`), orderBy('createdAt'));
            const unsubscribeFolders = onSnapshot(foldersQuery, (foldersSnapshot) => {
                const foldersData = foldersSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Folder))
                    .filter(folder => {
                        const isMember = folder.members && user.uid && folder.members[user.uid];
                        const isAdmin = workpanelData.members[user.uid] === 'admin';
                        return isMember || isAdmin;
                    });
                setFolders(foldersData);

                // Fetch Boards
                const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`));
                const unsubscribeBoards = onSnapshot(boardsQuery, async (boardsSnapshot) => {
                    const boardsData = boardsSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as Board))
                        .filter(board => {
                            const folder = foldersData.find(f => f.id === board.folderId);
                            const hasFolderAccess = folder && folder.members && user.uid && folder.members[user.uid];
                            const isBoardMember = board.members && user.uid && board.members[user.uid];
                            const isAdmin = workpanelData.members[user.uid] === 'admin';
                            
                            return !board.isPrivate || isBoardMember || hasFolderAccess || isAdmin;
                        });
                    setBoards(boardsData);
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
    
    const boardsByFolder = React.useMemo(() => {
        const grouped: {[key: string]: Board[]} = {};
        folders.forEach(folder => {
            grouped[folder.id] = [];
        });
        boards.forEach(board => {
            if (board.folderId && grouped[board.folderId]) {
                grouped[board.folderId].push(board);
            }
        });
        return grouped;
    }, [folders, boards]);
    
    const unassignedBoards = React.useMemo(() => {
        return boards.filter(board => !board.folderId);
    }, [boards]);


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
    
    const handleMoveBoard = async (boardId: string, newFolderId: string) => {
        const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
        try {
            await updateDoc(boardRef, { folderId: newFolderId || deleteField() });
            toast({ title: "Board moved successfully!" });
        } catch (error) {
            console.error("Error moving board: ", error);
            toast({ variant: 'destructive', title: 'Error moving board' });
        }
    };
    
    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) {
            return;
        }

        const sourceFolderId = source.droppableId;
        const destFolderId = destination.droppableId;

        if (sourceFolderId === destFolderId) {
            // Reordering within the same folder is not implemented yet.
            return;
        }
        
        handleMoveBoard(draggableId, destFolderId === 'unassigned' ? '' : destFolderId);
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

    const renderBoardGrid = (boardsToRender: Board[], folderId: string) => {
        return (
            <Droppable droppableId={folderId} type="BOARD">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-colors duration-200 rounded-lg p-2 min-h-[210px]",
                            snapshot.isDraggingOver && "bg-primary/10"
                        )}
                    >
                        {boardsToRender.map((board, index) => {
                            const boardMembers = Object.keys(board.members)
                                .map(uid => allUsers.get(uid))
                                .filter((u): u is UserProfile => !!u);
                            const canDelete = currentUserRole === 'admin' || (user?.uid === board.ownerId);

                            return (
                                <Draggable key={board.id} draggableId={board.id} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                        >
                                            <BoardCard
                                                board={board}
                                                workpanelId={workpanelId}
                                                folders={folders}
                                                boardMembers={boardMembers}
                                                openDeleteDialog={openDeleteDialog}
                                                handleMoveBoard={handleMoveBoard}
                                                canDelete={canDelete}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                        {canCreate && <CreateBoardDialog workpanelId={workpanelId} folderId={folderId === 'unassigned' ? '' : folderId} onBoardCreated={() => {}} />}
                    </div>
                )}
            </Droppable>
        );
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {canCreate && (
                <div className="mb-8">
                     <CreateFolderDialog workpanelId={workpanelId} />
                </div>
            )}
            <Accordion type="multiple" defaultValue={folders.map(f => f.id)} className="w-full space-y-4">
                 {folders.map(folder => (
                    <AccordionItem value={folder.id} key={folder.id} className="border rounded-lg bg-card">
                         <AccordionTrigger className="text-xl font-headline font-semibold hover:no-underline px-4 py-3 rounded-t-lg hover:bg-muted/50 data-[state=open]:border-b">
                           <div className="flex items-center justify-between w-full">
                               <span>{folder.name}</span>
                               <ShareFolderDialog workpanelId={workpanelId} folder={folder} allUsers={allUsers} onUpdate={()=>{}} />
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 px-2">
                             {renderBoardGrid(boardsByFolder[folder.id] || [], folder.id)}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
           
            {(unassignedBoards.length > 0 || folders.length === 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-headline font-semibold mb-4">Uncategorized Boards</h2>
                    {renderBoardGrid(unassignedBoards, 'unassigned')}
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
        </DragDropContext>
    )
}
