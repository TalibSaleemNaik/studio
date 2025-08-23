
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
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch, where, getDocs, deleteDoc, getDoc, orderBy, updateDoc, deleteField, collectionGroup, arrayUnion, arrayRemove, runTransaction } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";
import { logActivity, SimpleUser } from "@/lib/activity-logger";
import { UserProfile, Board as BoardType, WorkpanelRole, TeamRoom as TeamRoomType, TeamRoomRole } from "./board/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Checkbox } from "./ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";


interface Board extends BoardType {
  id: string;
}
interface TeamRoom extends TeamRoomType {
  id: string;
}

interface Workpanel {
    id: string;
    members: { [key: string]: WorkpanelRole };
}

function ShareTeamRoomDialog({ workpanelId, teamRoom, allUsers, onUpdate }: { workpanelId: string, teamRoom: TeamRoom, allUsers: Map<string, UserProfile>, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const { toast } = useToast();
    const teamRoomMembers = teamRoom.members || {};
    const teamRoomMemberUids = Object.keys(teamRoomMembers);
    const { user } = useAuth();

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
            const userToInviteDoc = querySnapshot.docs[0];
            const userToInviteId = userToInviteDoc.id;

            if (teamRoomMemberUids.includes(userToInviteId)) {
                throw new Error("User is already a member of this TeamRoom.");
            }

            // Transaction to update teamroom and user doc
             await runTransaction(db, async (transaction) => {
                const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
                const userDocRef = doc(db, `users`, userToInviteId);

                transaction.update(teamRoomRef, {
                    [`members.${userToInviteId}`]: 'editor', // Default role
                    memberUids: arrayUnion(userToInviteId),
                });

                transaction.update(userDocRef, {
                    accessibleWorkpanels: arrayUnion(workpanelId)
                });
            });
            
            toast({ title: "User invited to TeamRoom!" });
            setInviteEmail('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Invitation failed', description: error.message });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: TeamRoomRole) => {
        if(user?.uid === memberId) {
            toast({variant: 'destructive', title: 'You cannot change your own role.'});
            return;
        }
        try {
            const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
            await updateDoc(teamRoomRef, { [`members.${memberId}`]: newRole });
            toast({ title: "Member role updated." });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (user?.uid === memberId) {
            toast({ variant: 'destructive', title: 'You cannot remove yourself.' });
            return;
        }
        try {
            await runTransaction(db, async (transaction) => {
                const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, teamRoom.id);
                const userDocRef = doc(db, 'users', memberId);

                // --- READS FIRST ---
                const workpanelDoc = await transaction.get(doc(db, 'workspaces', workpanelId));
                if (!workpanelDoc.exists()) throw new Error("Workpanel not found.");

                // Check other boards
                const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`), where('memberUids', 'array-contains', memberId));
                const boardsSnap = await transaction.get(boardsQuery);
                const otherBoardAccess = boardsSnap.docs.length > 0;

                // Check other teamrooms
                const teamRoomsQuery = query(collection(db, `workspaces/${workpanelId}/teamRooms`), where('memberUids', 'array-contains', memberId));
                const teamRoomsSnap = await transaction.get(teamRoomsQuery);
                const otherTeamRoomAccess = teamRoomsSnap.docs.filter(d => d.id !== teamRoom.id).length > 0;
                
                // Check if user is a direct workpanel member
                const workpanelMemberAccess = !!workpanelDoc.data().members[memberId];

                const hasOtherAccess = otherBoardAccess || otherTeamRoomAccess || workpanelMemberAccess;

                // --- WRITES LAST ---
                // 1. Remove user from teamroom
                transaction.update(teamRoomRef, {
                    [`members.${memberId}`]: deleteField(),
                    memberUids: arrayRemove(memberId)
                });

                // 2. If no other access found, remove from accessibleWorkpanels
                if (!hasOtherAccess) {
                    transaction.update(userDocRef, {
                        accessibleWorkpanels: arrayRemove(workpanelId)
                    });
                }
            });

            toast({ title: "Member removed from TeamRoom." });
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
                    <DialogTitle>Share TeamRoom: {teamRoom.name}</DialogTitle>
                    <DialogDescription>
                        Invite people to this TeamRoom. They will get access to all teamboards inside it.
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
                        {teamRoomMemberUids.map(uid => {
                            const member = allUsers.get(uid);
                            const isCurrentUser = user?.uid === uid;
                            return member ? (
                                <div key={uid} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.displayName} {isCurrentUser && '(You)'}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={teamRoomMembers[uid]}
                                            onValueChange={(value) => handleRoleChange(uid, value as TeamRoomRole)}
                                            disabled={isCurrentUser}
                                        >
                                            <SelectTrigger className="w-[110px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manager">Manager</SelectItem>
                                                <SelectItem value="editor">Editor</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(uid)} disabled={isCurrentUser}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : null;
                        })}
                         {teamRoomMemberUids.length === 0 && <p className="text-sm text-muted-foreground">Only you have access to this TeamRoom.</p>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function CreateTeamRoomDialog({ workpanelId }: { workpanelId: string }) {
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
                members: { [user.uid]: 'manager' },
                memberUids: [user.uid]
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


function CreateBoardDialog({ workpanelId, teamRoomId, onBoardCreated }: { workpanelId: string, teamRoomId: string, onBoardCreated: () => void }) {
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
                workpanelId: workpanelId, // Add workpanelId to board document
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

function BoardCard({ board, workpanelId, teamRooms, boardMembers, openDeleteDialog, handleMoveBoard, canDelete }: { board: Board, workpanelId: string, teamRooms: TeamRoom[], boardMembers: UserProfile[], openDeleteDialog: (board: Board) => void, handleMoveBoard: (boardId: string, newTeamRoomId: string) => void, canDelete: boolean }) {
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
                                     {teamRooms.filter(f => f.id !== board.teamRoomId).map(teamRoom => (
                                         <DropdownMenuItem key={teamRoom.id} onSelect={() => handleMoveBoard(board.id, teamRoom.id)}>
                                             {teamRoom.name}
                                         </DropdownMenuItem>
                                     ))}
                                     { board.teamRoomId && 
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
    const [teamRooms, setTeamRooms] = useState<TeamRoom[]>([]);
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
    
    // Moved these hooks to the top to respect the Rules of Hooks
    const visibleBoards = React.useMemo(() => {
        if (!user || !workpanel) return [];

        const currentUserRole = workpanel.members[user.uid];
        return boards.filter(board => {
            if (currentUserRole && ['owner', 'admin'].includes(currentUserRole)) return true;
            if (board.members && board.members[user.uid]) return true;

            const parentRoom = teamRooms.find(r => r.id === board.teamRoomId);
            if (parentRoom && parentRoom.members && parentRoom.members[user.uid]) return true;

            if (currentUserRole && ['member', 'viewer'].includes(currentUserRole) && !board.isPrivate) return true;
            
            return false;
        });
    }, [boards, user, workpanel, teamRooms]);

    const visibleTeamRooms = React.useMemo(() => {
        if (!user || !workpanel) return [];
        const boardsInTeamRooms = new Set(visibleBoards.map(b => b.teamRoomId).filter(Boolean));
        const currentUserRole = workpanel.members[user.uid];

        return teamRooms.filter(teamRoom => {
            if (teamRoom.members && teamRoom.members[user.uid]) return true;
            if (currentUserRole && ['owner', 'admin', 'member', 'viewer'].includes(currentUserRole)) return true;
            if (boardsInTeamRooms.has(teamRoom.id)) return true;
            
            return false;
        });
    }, [teamRooms, user, workpanel, visibleBoards]);

    const visibleBoardsByTeamRoom = React.useMemo(() => {
        const grouped: {[key: string]: Board[]} = {};
        visibleTeamRooms.forEach(teamRoom => {
            grouped[teamRoom.id] = [];
        });
        visibleBoards.forEach(board => {
            if (board.teamRoomId && grouped[board.teamRoomId] !== undefined) {
                grouped[board.teamRoomId].push(board);
            }
        });
        return grouped;
    }, [visibleTeamRooms, visibleBoards]);

    const visibleUnassignedBoards = React.useMemo(() => {
        return visibleBoards.filter(board => !board.teamRoomId);
    }, [visibleBoards]);
    
    useEffect(() => {
        if (!user) {
            setLoading(true);
            return;
        }

        const fetchAllAccessibleData = async () => {
            setLoading(true);
            setError(null);
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    throw new Error("User profile not found.");
                }
                const userData = userDocSnap.data() as UserProfile;
                const accessibleWorkpanels = new Set(userData.accessibleWorkpanels || []);

                if (!accessibleWorkpanels.has(workpanelId)) {
                    setError("You do not have permission to view this workpanel.");
                    setLoading(false);
                    return;
                }
                
                const workpanelRef = doc(db, `workspaces/${workpanelId}`);
                const unsubscribeWorkpanel = onSnapshot(workpanelRef, async (workspaceSnap) => {
                    if (!workspaceSnap.exists()) {
                        setError("This workpanel does not exist.");
                        setLoading(false);
                        return;
                    }
                    const workpanelData = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workpanel;
                    setWorkpanel(workpanelData);
                    
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
                    
                    const teamRoomsQuery = query(collection(db, `workspaces/${workpanelId}/teamRooms`), orderBy('createdAt'));
                    const unsubscribeTeamRooms = onSnapshot(teamRoomsQuery, (teamRoomsSnapshot) => {
                        const teamRoomsData = teamRoomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamRoom));
                        setTeamRooms(teamRoomsData);

                        const boardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`));
                        const unsubscribeBoards = onSnapshot(boardsQuery, (boardsSnapshot) => {
                            const boardsData = boardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
                            setBoards(boardsData);
                            setLoading(false);
                            setError(null);
                        }, (err) => {
                            console.error("Error fetching boards:", err);
                            setError("Failed to load teamboards.");
                            setLoading(false);
                        });
                        return () => unsubscribeBoards();
                    }, (err) => {
                         console.error("Error fetching team rooms:", err);
                         setError("Failed to load team rooms.");
                         setLoading(false);
                    });
                    return () => unsubscribeTeamRooms();
                }, (err) => {
                    console.error("Error fetching workpanel:", err);
                    setError("Failed to load workpanel data.");
                    setLoading(false);
                });
                
                return () => unsubscribeWorkpanel();
            } catch (err) {
                 console.error("Error fetching accessible data:", err);
                 setError("Failed to determine your access permissions.");
                 setLoading(false);
            }
        };

        fetchAllAccessibleData();

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
    
    const handleMoveBoard = async (boardId: string, newTeamRoomId: string) => {
        const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
        try {
            await updateDoc(boardRef, { teamRoomId: newTeamRoomId || deleteField() });
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

        const sourceTeamRoomId = source.droppableId;
        const destTeamRoomId = destination.droppableId;

        if (sourceTeamRoomId === destTeamRoomId) {
            // Reordering within the same TeamRoom is not implemented yet.
            return;
        }
        
        handleMoveBoard(draggableId, destTeamRoomId === 'unassigned' ? '' : destTeamRoomId);
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
    const canCreate = currentUserRole === 'admin' || currentUserRole === 'owner' || currentUserRole === 'member';

    const renderBoardGrid = (boardsToRender: Board[], teamRoomId: string, canCreateBoardsInRoom: boolean) => {
        return (
            <Droppable droppableId={teamRoomId} type="BOARD">
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
                            const boardMembers = (board.memberUids || [])
                                .map(uid => allUsers.get(uid))
                                .filter((u): u is UserProfile => !!u);
                            const canDelete = currentUserRole === 'owner' || currentUserRole === 'admin' || (user?.uid === board.ownerId);

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
                                                teamRooms={teamRooms}
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
                        {canCreateBoardsInRoom && <CreateBoardDialog workpanelId={workpanelId} teamRoomId={teamRoomId === 'unassigned' ? '' : teamRoomId} onBoardCreated={() => {}} />}
                    </div>
                )}
            </Droppable>
        );
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {canCreate && (
                <div className="mb-8">
                     <CreateTeamRoomDialog workpanelId={workpanelId} />
                </div>
            )}
            <Accordion type="multiple" defaultValue={visibleTeamRooms.map(f => f.id)} className="w-full space-y-4">
                 {visibleTeamRooms.map(teamRoom => {
                    const userTeamRoomRole = user?.uid ? teamRoom.members?.[user.uid] : undefined;
                    const canCreateBoardsInRoom = canCreate || userTeamRoomRole === 'manager' || userTeamRoomRole === 'editor';
                     
                    return (
                        <AccordionItem value={teamRoom.id} key={teamRoom.id} className="border rounded-lg bg-card">
                            <div className="flex items-center justify-between px-4 py-3 rounded-t-lg data-[state=open]:border-b hover:bg-muted/50">
                                <AccordionTrigger className="text-xl font-headline font-semibold hover:no-underline flex-1 text-left py-0">
                                <span>{teamRoom.name}</span>
                                </AccordionTrigger>
                                <ShareTeamRoomDialog workpanelId={workpanelId} teamRoom={teamRoom} allUsers={allUsers} onUpdate={()=>{}} />
                            </div>
                            <AccordionContent className="pt-4 px-2">
                                {renderBoardGrid(visibleBoardsByTeamRoom[teamRoom.id] || [], teamRoom.id, canCreateBoardsInRoom)}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
           
            {(visibleUnassignedBoards.length > 0 || visibleTeamRooms.length === 0) && (
                <div className="mt-8">
                    <h2 className="text-xl font-headline font-semibold mb-4">Uncategorized Boards</h2>
                    {renderBoardGrid(visibleUnassignedBoards, 'unassigned', canCreate)}
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

    
