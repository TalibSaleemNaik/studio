

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Loader2, Share, Search, ChevronDown, Trash2, History, Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch, getDoc, getDocs, deleteField } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Task, Columns, BoardMember, Board as BoardType, TeamRoom as TeamRoomType, WorkpanelRole, TeamRoomRole, BoardRole } from './board/types';
import { TaskDetailsDrawer } from './board/task-details-drawer';
import { CreateGroupDialog } from './board/create-group-dialog';
import { BoardColumn } from './board/board-column';
import { logActivity, SimpleUser } from '@/lib/activity-logger';
import { ActivityDrawer } from './board/activity-drawer';
import { isAfter, isBefore, addDays, startOfToday } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { TableView } from './board/table-view';
import { useSearchParams } from 'next/navigation';

function BoardMembersDialog({ workpanelId, boardId, boardMembers, userRole }: { workpanelId: string, boardId: string, boardMembers: BoardMember[], userRole: BoardRole }) {
    const [inviteEmail, setInviteEmail] = React.useState('');
    const [isInviting, setIsInviting] = React.useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    
    if (userRole !== 'manager') return null;

    const handleInvite = async () => {
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
            
            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
            await updateDoc(boardRef, {
                [`members.${userId}`]: 'editor' // Default role for direct board invite
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
        const isSelf = user?.uid === memberId;
         if (isSelf) {
            toast({variant: 'destructive', title: 'You cannot remove yourself.'});
            return;
        }

        try {
            const boardRef = doc(db, `workspaces/${workpanelId}/boards`, boardId);
            const memberToRemove = boardMembers.find(m => m.uid === memberId);
            await updateDoc(boardRef, {
                [`members.${memberId}`]: deleteField()
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
            toast({ variant: 'destructive', title: 'Failed to remove member.' });
        }
    }


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
                        {boardMembers.map(member => (
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
                                        disabled={user?.uid === member.uid}
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(member.uid)} disabled={user?.uid === member.uid}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Board({ boardId, workpanelId }: { boardId: string, workpanelId?: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = React.useState<Columns | null>(null);
  const [board, setBoard] = React.useState<BoardType | null>(null);
  const [userRole, setUserRole] = React.useState<BoardRole | 'guest'>('guest');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [boardMembers, setBoardMembers] = React.useState<BoardMember[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = React.useState<string[]>([]);
  const [dueDateFilter, setDueDateFilter] = React.useState('any');
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState('kanban');
  const { toast } = useToast();

  const allTasks = React.useMemo(() => columns ? Object.values(columns).flatMap(c => c.items) : [], [columns]);

  const filteredTasks = React.useMemo(() => {
    const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);
    
    let tasksToFilter = allTasks;
    // If user is a viewer, they only see tasks assigned to them
    if (userRole === 'viewer' && user) {
        tasksToFilter = allTasks.filter(item => item.assignees?.includes(user.uid));
    }

    return tasksToFilter.filter(item => {
        const searchMatch = item.content.toLowerCase().includes(searchTerm.toLowerCase());
        
        const assigneeMatch = selectedAssignees.length === 0 || 
            item.assignees?.some(assignee => selectedAssignees.includes(assignee));

        const priorityMatch = selectedPriorities.length === 0 ||
            (item.priority && selectedPriorities.includes(item.priority));

        const dueDateMatch = () => {
            if (dueDateFilter === 'any' || !item.dueDate) return true;
            const today = startOfToday();
            const taskDueDate = asJsDate(item.dueDate);
            if (dueDateFilter === 'overdue') {
                return isBefore(taskDueDate, today);
            }
            if (dueDateFilter === 'due-soon') {
                const threeDaysFromNow = addDays(today, 3);
                return isAfter(taskDueDate, today) && isBefore(taskDueDate, threeDaysFromNow);
            }
            return true;
        };
        
        return searchMatch && assigneeMatch && priorityMatch && dueDateMatch();
    });
  }, [allTasks, searchTerm, selectedAssignees, selectedPriorities, dueDateFilter, userRole, user]);

  const filteredColumns = React.useMemo(() => {
      if (!columns) return {};
      // If the user is a viewer, we still want to show all columns, even if they are empty.
      // But the tasks within them should be filtered.
      const taskIdsToShow = new Set(filteredTasks.map(t => t.id));

      return Object.fromEntries(
        Object.entries(columns).map(([columnId, column]) => [
            columnId,
            {
                ...column,
                items: column.items.filter(item => taskIdsToShow.has(item.id))
            }
        ])
      );
  }, [columns, filteredTasks]);

    const calculateEffectiveRole = React.useCallback((
        uid: string,
        boardData: BoardType,
        teamRoomData: TeamRoomType | null,
        workpanelData: { members: { [key: string]: WorkpanelRole } } | null
    ): BoardRole | 'guest' => {
        
        // 1. Check for direct board role
        if (boardData.members && boardData.members[uid]) {
            return boardData.members[uid];
        }

        // 2. Check for parent TeamRoom role and convert to board role
        if (teamRoomData?.members && teamRoomData.members[uid]) {
            const teamRoomRole = teamRoomData.members[uid];
            if (teamRoomRole === 'manager') return 'manager';
            if (teamRoomRole === 'editor') return 'editor';
            if (teamRoomRole === 'viewer') return 'viewer';
        }
        
        // 3. Check for parent Workpanel role and convert to board role
        if (workpanelData?.members && workpanelData.members[uid]) {
            const workpanelRole = workpanelData.members[uid];
            if (workpanelRole === 'owner' || workpanelRole === 'admin') return 'manager';
            if (workpanelRole === 'member') return 'editor';
            if (workpanelRole === 'viewer') return 'viewer';
        }
        
        return 'guest'; // Default if no role is found
    }, []);

  React.useEffect(() => {
    if (!user || !boardId || !workpanelId) {
        setLoading(true);
        if (!workpanelId) {
          setError("Workpanel ID is missing. Please access this board from the dashboard.");
          setLoading(false);
        }
        return;
    }

    const boardRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}`);
    
    const unsubscribeBoard = onSnapshot(boardRef, async (boardSnap) => {
        if (!boardSnap.exists()) {
            setError("Board not found or you don't have access.");
            setLoading(false);
            return;
        }
        const boardData = { id: boardSnap.id, ...boardSnap.data() } as BoardType;
        setBoard(boardData);
        setError(null);
        
        const workpanelRef = doc(db, `workspaces/${workpanelId}`);
        const workpanelSnap = await getDoc(workpanelRef);
        const workpanelData = workpanelSnap.exists() ? workpanelSnap.data() as { members: { [key: string]: WorkpanelRole } } : null;

        let teamRoomData: TeamRoomType | null = null;
        if (boardData.teamRoomId) {
            const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, boardData.teamRoomId);
            const teamRoomSnap = await getDoc(teamRoomRef);
            teamRoomData = teamRoomSnap.exists() ? {id: teamRoomSnap.id, ...teamRoomSnap.data()} as TeamRoomType : null;
        }
        
        const effectiveRole = calculateEffectiveRole(user.uid, boardData, teamRoomData, workpanelData);
        
        if (effectiveRole === 'guest') {
             setError("You do not have permission to view this board.");
             setLoading(false);
             return;
        }
        setUserRole(effectiveRole);


        const memberUIDs = Object.keys(boardData.members || {});
        try {
            if (memberUIDs.length > 0) {
                 const userDocs = await Promise.all(memberUIDs.map(uid => getDoc(doc(db, 'users', uid))));
                 const membersData: BoardMember[] = userDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => {
                        const userData = docSnap.data() as Omit<BoardMember, 'uid' | 'role'>;
                        return {
                            ...userData,
                            uid: docSnap.id,
                            role: boardData.members[docSnap.id],
                        }
                    });
                setBoardMembers(membersData);
            } else {
                 setBoardMembers([]);
            }
        } catch (e) {
             console.error("Error fetching board members:", e);
             toast({ variant: 'destructive', title: 'Error loading board members' });
        }

        const groupsQuery = query(collection(db, `workspaces/${workpanelId}/boards/${boardId}/groups`), orderBy('order'));
        const tasksQuery = query(collection(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`));

        const unsubscribeGroups = onSnapshot(groupsQuery, (groupsSnapshot) => {
             const groupsData = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { name: string; order: number } }));
             
             const unsubscribeTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
                 const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Task, 'id'> }));
                 
                 const newColumns: Columns = {};
                 for (const group of groupsData) {
                    newColumns[group.id] = {
                        id: group.id,
                        name: group.name,
                        order: group.order,
                        items: tasksData
                            .filter(task => task.groupId === group.id)
                            .sort((a, b) => a.order - b.order),
                    };
                 }
                 setColumns(newColumns);
                 setLoading(false);
             }, (taskError) => {
                 console.error("Error fetching tasks:", taskError);
                 setError("Failed to load tasks.");
                 setLoading(false);
             });
             
             return () => unsubscribeTasks();
        }, (groupError) => {
            console.error("Error fetching groups:", groupError);
            setError("Failed to load board columns.");
            setLoading(false);
        });

        return () => unsubscribeGroups();

    }, (boardError) => {
        console.error("Error fetching board:", boardError);
        setError("An error occurred while fetching board data.");
        if (boardError.code === 'permission-denied') {
            setError("You do not have permission to view this board.");
        }
        setLoading(false);
    });

    return () => {
        unsubscribeBoard();
    };
}, [user, boardId, workpanelId, toast, calculateEffectiveRole]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type, draggableId } = result;
    if (!destination || !columns || !user || !workpanelId) return;
    
    // Role-based drag-and-drop validation
    if (userRole === 'viewer') return;
    if (type === 'COLUMN' && userRole !== 'manager') {
        toast({ variant: "destructive", title: "Permission Denied", description: "Only managers can reorder columns." });
        return;
    }
    if (type === 'TASK' && userRole === 'editor') {
        const task = allTasks.find(t => t.id === draggableId);
        if (!task || !task.assignees?.includes(user.uid)) {
            toast({ variant: "destructive", title: "Permission Denied", description: "You can only move tasks assigned to you." });
            return;
        }
    }

    const newColumnsState = { ...columns };

    if (type === 'COLUMN') {
        const orderedColumns = Object.values(newColumnsState).sort((a,b) => a.order - b.order);
        const [movedColumn] = orderedColumns.splice(source.index, 1);
        orderedColumns.splice(destination.index, 0, movedColumn);

        orderedColumns.forEach((col, index) => {
            newColumnsState[col.id].order = index;
        });
        
        setColumns(newColumnsState);
        
        const batch = writeBatch(db);
        orderedColumns.forEach((col) => {
            batch.update(doc(db, `workspaces/${workpanelId}/boards/${boardId}/groups`, col.id), { order: col.order });
        });
        await batch.commit();
        return;
    }
    
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const startColumn = newColumnsState[sourceColId];
    const endColumn = newColumnsState[destColId];
    
    if (!startColumn || !endColumn) return;
    
    const sourceItems = [...startColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);

    if (sourceColId === destColId) {
      sourceItems.splice(destination.index, 0, removed);
      const newColumn = { ...startColumn, items: sourceItems };
      newColumnsState[sourceColId] = newColumn;
      
      setColumns(newColumnsState);
      
      const batch = writeBatch(db);
      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });
      await batch.commit();

    } else {
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumnsState[sourceColId] = { ...startColumn, items: sourceItems };
      newColumnsState[destColId] = { ...endColumn, items: destItems };
      
      setColumns(newColumnsState);
      
      const task = columns[source.droppableId].items[source.index];
      
      const simpleUser: SimpleUser = {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
        };
      logActivity(workpanelId, boardId, simpleUser, `moved task "${task.content}" from "${startColumn.name}" to "${endColumn.name}".`, task.id);
      
      const batch = writeBatch(db);
      const movedTaskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, removed.id);
      batch.update(movedTaskRef, { groupId: destColId, order: destination.index });
      
      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });
      destItems.forEach((item, index) => {
         const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
         batch.update(taskRef, { order: index });
      });
      
      await batch.commit();
    }
  };
  
  const handleTaskDeleted = (taskId: string) => {
      setSelectedTask(null);
  }


  if (loading) {
    return <BoardSkeleton />;
  }

  if (error) {
    return (
        <div className="flex items-center justify-center h-full text-center text-destructive">
            <p>{error}</p>
        </div>
    );
  }
  
  if (!columns || !board || !workpanelId || userRole === 'guest') {
    return <BoardSkeleton />;
  }

  const orderedColumns = Object.values(filteredColumns).sort((a,b) => a.order - b.order);

  const handleAssigneeSelect = (assigneeId: string) => {
    setSelectedAssignees(prev => 
        prev.includes(assigneeId) 
        ? prev.filter(id => id !== assigneeId) 
        : [...prev, assigneeId]
    );
  };

  const handlePrioritySelect = (priority: string) => {
    setSelectedPriorities(prev => 
        prev.includes(priority) 
        ? prev.filter(p => p !== priority) 
        : [...prev, priority]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAssignees([]);
    setSelectedPriorities([]);
    setDueDateFilter('any');
  }

  const hasActiveFilters = searchTerm || selectedAssignees.length > 0 || selectedPriorities.length > 0 || dueDateFilter !== 'any';

  return (
      <>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
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
                        className="pl-9 w-60 bg-muted"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-1">
                            <span>All assignees</span>
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
                            <span>All priorities</span>
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
                                            <span>{p}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                    <SelectTrigger className="w-[180px]">
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
                <BoardMembersDialog workpanelId={workpanelId} boardId={boardId} boardMembers={boardMembers} userRole={userRole} />
                 {activeView === 'kanban' && (
                    <CreateGroupDialog 
                        workpanelId={workpanelId}
                        boardId={boardId}
                        columnCount={orderedColumns.length}
                        userRole={userRole}
                    />
                )}
            </div>
        </div>
        {selectedTask && (
            <TaskDetailsDrawer 
                task={selectedTask} 
                workspaceId={workpanelId}
                boardId={boardId}
                boardMembers={boardMembers}
                isOpen={!!selectedTask} 
                onOpenChange={(open) => !open && setSelectedTask(null)} 
                onDelete={handleTaskDeleted}
                userRole={userRole}
            />
        )}
        <ActivityDrawer
            workpanelId={workpanelId}
            boardId={boardId}
            isOpen={isActivityDrawerOpen}
            onOpenChange={setIsActivityDrawerOpen}
        />
        {activeView === 'kanban' ? (
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                {(provided) => (
                    <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className="flex-1 flex items-start gap-5 overflow-x-auto pb-4 -mx-8 px-8"
                    >
                    {orderedColumns.map((column, index) => (
                        <BoardColumn
                            key={column.id}
                            column={column}
                            index={index}
                            boardMembers={boardMembers}
                            onTaskClick={setSelectedTask}
                            workpanelId={workpanelId}
                            boardId={boardId}
                            userRole={userRole}
                        />
                    ))}
                    {provided.placeholder}
                    </div>
                )}
                </Droppable>
            </DragDropContext>
        ) : (
            <TableView 
                tasks={filteredTasks}
                boardMembers={boardMembers}
                onTaskClick={setSelectedTask}
            />
        )}
    </>
  )
}

function BoardSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="flex-1 flex items-start gap-5 overflow-x-auto pb-4 -mx-8 px-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="shrink-0 w-80">
              <div className="bg-muted/30 rounded-lg p-3 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-8" />
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-12 w-full" />
              </div>
              </div>
          </div>
        ))}
      </div>
    </>
  )
}

export const DynamicBoard = dynamic(() => Promise.resolve(Board), {
  ssr: false,
  loading: () => <BoardSkeleton />,
});

    