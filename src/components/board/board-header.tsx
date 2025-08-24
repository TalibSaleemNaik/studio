
'use client';

import React from 'react';
import { Loader2, Share, Search, ChevronDown, Trash2, History, Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { Board, BoardMember, BoardRole } from './types';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, doc, query, where, getDocs, runTransaction, arrayUnion, updateDoc, deleteField, arrayRemove, getDoc } from 'firebase/firestore';
import { logActivity, SimpleUser } from '@/lib/activity-logger';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

function BoardMembersDialog({ workpanelId, boardId, board, boardMembers, userRole }: { workpanelId: string, boardId: string, board: Board, boardMembers: BoardMember[], userRole: BoardRole }) {
    const [inviteEmail, setInviteEmail] = React.useState('');
    const [isInviting, setIsInviting] = React.useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    
    const canManageMembers = userRole === 'manager';
    const directMembers = boardMembers.filter(m => board.members[m.uid]);

    const handleInvite = async () => {
        if (!canManageMembers) return;
        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            toast({ variant: 'destructive', title: 'Please enter an email address.' });
            return;
        }

        setIsInviting(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', trimmedEmail));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'User not found.' });
                setIsInviting(false);
                return;
            }

            const userToInviteDoc = querySnapshot.docs[0];
            const userToInvite = userToInviteDoc.data();
            const userId = userToInviteDoc.id;

            if (boardMembers.some(member => member.uid === userId)) {
                toast({ variant: 'destructive', title: 'User is already a member of this board.' });
                setIsInviting(false);
                return;
            }
            
            await runTransaction(db, async (transaction) => {
                const boardTransactionRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
                const userDocRef = doc(db, `users`, userId);

                transaction.update(boardTransactionRef, {
                    [`members.${userId}`]: 'editor',
                    memberUids: arrayUnion(userId)
                });
                 transaction.update(userDocRef, {
                    accessibleWorkpanels: arrayUnion(workpanelId)
                });
            });
            
            if (user) {
                 const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `invited ${userToInvite.displayName} (${userToInvite.email}) to the board.`);
            }

            toast({ title: 'User invited successfully!' });
            setInviteEmail('');

        } catch (error) {
            console.error("Error inviting user:", error);
            toast({ variant: 'destructive', title: 'Failed to invite user.', description: (error as Error).message });
        } finally {
            setIsInviting(false);
        }
    };
    
    const handleRoleChange = async (memberId: string, newRole: BoardRole) => {
        if (!canManageMembers) return;
        const isSelf = user?.uid === memberId;
        if (isSelf) {
            toast({variant: 'destructive', title: 'You cannot change your own role.'});
            return;
        }

        try {
            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
            
            await updateDoc(boardRef, {
                [`members.${memberId}`]: newRole
            });
            toast({ title: 'Member role updated.' });
        } catch (error) {
            console.error("Error updating role:", error);
            toast({ variant: 'destructive', title: 'Failed to update member role.' });
        }
    };
    
    const handleRemoveMember = async (memberId: string) => {
        if (!canManageMembers) return;
        const isSelf = user?.uid === memberId;
        if (isSelf) {
            toast({ variant: 'destructive', title: 'You cannot remove yourself.' });
            return;
        }

        const memberToRemove = boardMembers.find(m => m.uid === memberId);
        if (!memberToRemove) return;

        try {
            const otherBoardsQuery = query(collection(db, `workspaces/${workpanelId}/boards`), where('memberUids', 'array-contains', memberId));
            const teamRoomsQuery = query(collection(db, `workspaces/${workpanelId}/teamRooms`), where('memberUids', 'array-contains', memberId));

            const [otherBoardsSnap, teamRoomsSnap] = await Promise.all([
                getDocs(otherBoardsQuery),
                getDocs(teamRoomsQuery),
            ]);

            const otherBoardAccess = otherBoardsSnap.docs.filter(d => d.id !== boardId).length > 0;
            const teamRoomAccess = teamRoomsSnap.size > 0;

            await runTransaction(db, async (transaction) => {
                const currentBoardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
                const workpanelRef = doc(db, 'workspaces', workpanelId);
                const userDocRef = doc(db, 'users', memberId);

                const workpanelDoc = await transaction.get(workpanelRef);
                if (!workpanelDoc.exists()) {
                    throw new Error("Workpanel not found.");
                }
                const workpanelMemberAccess = !!workpanelDoc.data().members[memberId];
                const hasOtherAccess = otherBoardAccess || teamRoomAccess || workpanelMemberAccess;

                transaction.update(currentBoardRef, {
                    [`members.${memberId}`]: deleteField(),
                    memberUids: arrayRemove(memberId)
                });

                if (!hasOtherAccess) {
                    transaction.update(userDocRef, {
                        accessibleWorkpanels: arrayRemove(workpanelId)
                    });
                }
            });

            if (user && memberToRemove) {
                 const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `removed ${memberToRemove.displayName} from the board.`);
            }

            toast({ title: 'Member removed.' });
        } catch (error) {
            console.error("Error removing member:", error);
            toast({ variant: 'destructive', title: 'Failed to remove member.', description: (error as Error).message });
        }
    };


    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Share className="mr-2 h-4 w-4" /> Share
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share Board</DialogTitle>
                    <DialogDescription>
                        Manage who has access to this board.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    {canManageMembers ? (
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
                     ) : (
                        <p className="text-sm text-muted-foreground">Only managers can invite new members.</p>
                     )}
                    <div className="space-y-2">
                        <h4 className="font-medium">People with access</h4>
                        {directMembers.map(member => (
                            <div key={member.uid} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={member.photoURL} />
                                        <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{member.displayName} {user?.uid === member.uid && "(You)"}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select 
                                        value={member.role}
                                        onValueChange={(value) => handleRoleChange(member.uid, value as BoardRole)}
                                        disabled={user?.uid === member.uid || !canManageMembers}
                                    >
                                        <SelectTrigger className="w-[110px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manager">Manager</SelectItem>
                                            <SelectItem value="editor">Editor</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                            <SelectItem value="guest">Guest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive" 
                                        onClick={() => handleRemoveMember(member.uid)} 
                                        disabled={user?.uid === member.uid || !canManageMembers}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                         {directMembers.length === 0 && <p className="text-sm text-muted-foreground">No one has been invited directly to this board.</p>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface BoardHeaderProps {
    workpanelId: string;
    boardId: string;
    board: Board;
    setBoard: React.Dispatch<React.SetStateAction<Board | null>>;
    boardMembers: BoardMember[];
    userRole: BoardRole;
    activeView: string;
    setActiveView: (view: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedAssignees: string[];
    handleAssigneeSelect: (id: string) => void;
    selectedPriorities: string[];
    handlePrioritySelect: (priority: string) => void;
    dueDateFilter: string;
    setDueDateFilter: (filter: string) => void;
    hasActiveFilters: boolean;
    clearFilters: () => void;
    setIsActivityDrawerOpen: (isOpen: boolean) => void;
    openCreateGroupDialog: React.ReactNode;
}

export function BoardHeader({
    workpanelId,
    boardId,
    board,
    setBoard,
    boardMembers,
    userRole,
    activeView,
    setActiveView,
    searchTerm,
    setSearchTerm,
    selectedAssignees,
    handleAssigneeSelect,
    selectedPriorities,
    handlePrioritySelect,
    dueDateFilter,
    setDueDateFilter,
    hasActiveFilters,
    clearFilters,
    setIsActivityDrawerOpen,
    openCreateGroupDialog,
}: BoardHeaderProps) {
    const directMembers = boardMembers.filter(m => board.members[m.uid]);
    const { user } = useAuth();
    const { toast } = useToast();
    const [originalBoardName, setOriginalBoardName] = React.useState(board.name);
    const canEditHeader = userRole === 'manager';

  const handleTitleBlur = async () => {
    if (!canEditHeader) return;
    const newName = board.name.trim();
    if (newName && newName !== originalBoardName) {
      try {
        const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
        await updateDoc(boardRef, { name: newName });
        if (user) {
          const simpleUser: SimpleUser = { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL };
          await logActivity(workpanelId, boardId, simpleUser, `renamed the board to "${newName}" (from "${originalBoardName}")`);
        }
        toast({ title: "Board renamed successfully" });
        setOriginalBoardName(newName);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to rename board' });
        setBoard(prev => prev ? { ...prev, name: originalBoardName } : null);
      }
    } else if (newName === '') { // Prevent blank name
        setBoard(prev => prev ? { ...prev, name: originalBoardName } : null);
    }
  };
  
  return (
    <div className="space-y-4 mb-4">
        {/* Top Header: Title, Description, and Sharing */}
        <div className="flex items-center justify-between gap-4">
             <Input 
                value={board.name}
                onChange={(e) => setBoard(prev => prev ? { ...prev, name: e.target.value } : null)}
                onFocus={() => setOriginalBoardName(board.name)}
                onBlur={handleTitleBlur}
                disabled={!canEditHeader}
                className="font-headline text-3xl font-bold border-none shadow-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
                aria-label="Board title"
            />
             <div className="flex items-center gap-2">
                 <div className="flex items-center">
                     <TooltipProvider>
                        <div className="flex -space-x-2 mr-2">
                            {directMembers.slice(0, 3).map(member => (
                                <Tooltip key={member.uid}>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarImage src={member.photoURL} alt={member.displayName} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>{member.displayName}</TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                     </TooltipProvider>
                     {directMembers.length > 3 && (
                        <Badge variant="secondary" className="mr-2">
                            +{directMembers.length - 3}
                        </Badge>
                     )}
                </div>
                <BoardMembersDialog workpanelId={workpanelId} boardId={boardId} board={board} boardMembers={boardMembers} userRole={userRole} />
            </div>
        </div>

        {/* Bottom Header: Filters and Actions */}
        <div className="flex items-center justify-between flex-wrap gap-y-2 gap-x-2">
            <div className="flex items-center gap-2 flex-wrap">
                <Tabs value={activeView} onValueChange={setActiveView}>
                <TabsList>
                    <TabsTrigger value="kanban"><LayoutGrid className="mr-2 h-4 w-4" />Kanban</TabsTrigger>
                    <TabsTrigger value="table"><List className="mr-2 h-4 w-4" />Table</TabsTrigger>
                </TabsList>
            </Tabs>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-40 md:w-60 bg-muted"
                />
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-1">
                        <span>Assignees</span>
                        {selectedAssignees.length > 0 && <Badge variant="secondary">{selectedAssignees.length}</Badge>}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-64">
                    <Command>
                        <CommandInput placeholder="Filter assignees..." />
                        <CommandList>
                            <CommandEmpty>No assignees found.</CommandEmpty>
                            <CommandGroup>
                                {boardMembers.map(member => (
                                    <CommandItem 
                                        key={member.uid} 
                                        value={member.displayName || member.uid}
                                        onSelect={() => handleAssigneeSelect(member.uid)}
                                    >
                                        <Checkbox className="mr-2" checked={selectedAssignees.includes(member.uid)} />
                                        <Avatar className="h-6 w-6 mr-2">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span>{member.displayName}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
                <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-1">
                        <span>Priority</span>
                            {selectedPriorities.length > 0 && <Badge variant="secondary">{selectedPriorities.length}</Badge>}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                    <PopoverContent className="p-0 w-64">
                    <Command>
                        <CommandInput placeholder="Filter priorities..." />
                        <CommandList>
                            <CommandEmpty>No priorities found.</CommandEmpty>
                            <CommandGroup>
                                {['low', 'medium', 'high', 'urgent'].map(p => (
                                    <CommandItem 
                                        key={p}
                                        value={p}
                                        onSelect={() => handlePrioritySelect(p)}
                                    >
                                        <Checkbox className="mr-2" checked={selectedPriorities.includes(p)} />
                                        <span className="capitalize">{p}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                <SelectTrigger className="w-auto gap-1">
                    <SelectValue placeholder="Filter by due date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="due-soon">Due soon (3d)</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
            </Select>
            {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                    Clear filters
                </Button>
            )}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsActivityDrawerOpen(true)}>
                    <History className="mr-2 h-4 w-4" />
                    Activity
                </Button>
                {activeView === 'kanban' && userRole === 'manager' && openCreateGroupDialog}
            </div>
        </div>
    </div>
  )
}
