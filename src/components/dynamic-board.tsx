
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Loader2, Share, Search, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch, deleteDoc, arrayUnion, arrayRemove, getDoc, getDocs, deleteField } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Task, Columns, BoardMember } from './board/types';
import { TaskDetailsDrawer } from './board/task-details-drawer';
import { CreateGroupDialog } from './board/create-group-dialog';
import { BoardColumn } from './board/board-column';

function BoardMembersDialog({ workspaceId, boardId, boardMembers }: { workspaceId: string, boardId: string, boardMembers: BoardMember[] }) {
    const [inviteEmail, setInviteEmail] = React.useState('');
    const [isInviting, setIsInviting] = React.useState(false);
    const { toast } = useToast();

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            toast({ variant: 'destructive', title: 'Please enter an email address.' });
            return;
        }
        setIsInviting(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', inviteEmail.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'User not found.' });
                setIsInviting(false);
                return;
            }

            const userToInvite = querySnapshot.docs[0];
            const userId = userToInvite.id;

            if (boardMembers.some(member => member.uid === userId)) {
                toast({ variant: 'destructive', title: 'User is already a member of this board.' });
                setIsInviting(false);
                return;
            }

            const boardRef = doc(db, `workspaces/${workspaceId}/boards`, boardId);
            await updateDoc(boardRef, {
                [`members.${userId}`]: 'editor'
            });

            toast({ title: 'User invited successfully!' });
            setInviteEmail('');

        } catch (error) {
            console.error("Error inviting user:", error);
            toast({ variant: 'destructive', title: 'Failed to invite user.' });
        } finally {
            setIsInviting(false);
        }
    };
    
    const handleRoleChange = async (memberId: string, newRole: 'editor' | 'viewer' | 'owner') => {
        if (newRole === 'owner') return; // Should have a separate "transfer ownership" flow
        try {
            const boardRef = doc(db, `workspaces/${workspaceId}/boards`, boardId);
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
        try {
            const boardRef = doc(db, `workspaces/${workspaceId}/boards`, boardId);
            await updateDoc(boardRef, {
                [`members.${memberId}`]: deleteField()
            });
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
                                        <p className="font-semibold">{member.displayName}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                {member.role !== 'owner' ? (
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={member.role}
                                            onValueChange={(value) => handleRoleChange(member.uid, value as 'editor' | 'viewer')}
                                        >
                                            <SelectTrigger className="w-[110px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="editor">Editor</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveMember(member.uid)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-sm text-muted-foreground pr-4">Owner</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Board({ boardId }: { boardId: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = React.useState<Columns | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [boardMembers, setBoardMembers] = React.useState<BoardMember[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = React.useState<string[]>([]);
  const { toast } = useToast();

  const workspaceId = 'default-workspace';
  
  const allLabels = React.useMemo(() => {
    if (!columns) return [];
    const labels = new Set<string>();
    Object.values(columns).forEach(column => {
        column.items.forEach(item => {
            item.tags?.forEach(tag => labels.add(tag));
        });
    });
    return Array.from(labels).sort();
  }, [columns]);

  React.useEffect(() => {
    if (!user || !boardId || !workspaceId) {
        setLoading(true);
        return;
    }

    setLoading(true);
    
    const unsubscribeMembers = onSnapshot(doc(db, `workspaces/${workspaceId}/boards`, boardId), async (boardSnap) => {
        const boardData = boardSnap.data();
        if (boardData && boardData.members) {
            try {
                const memberUIDs = Object.keys(boardData.members);
                if (memberUIDs.length === 0) {
                    setBoardMembers([]);
                    return;
                }

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
            } catch (error) {
                console.error("Error fetching board members:", error);
                toast({ variant: 'destructive', title: 'Error loading board members' });
            }
        } else {
             setBoardMembers([]);
        }
    });


    const groupsQuery = query(
      collection(db, `workspaces/${workspaceId}/groups`),
      where('boardId', '==', boardId),
      orderBy('order')
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, (querySnapshot) => {
      const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { name: string; order: number } }));
      
      const tasksQuery = query(
        collection(db, `workspaces/${workspaceId}/tasks`),
        where('boardId', '==', boardId)
      );

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
      }, (error) => {
        console.error("Error fetching tasks:", error);
        setLoading(false);
      });

      return () => unsubscribeTasks();
    }, (error) => {
        console.error("Error fetching groups:", error);
        setLoading(false);
    });

    return () => {
        unsubscribeGroups();
        unsubscribeMembers();
    }

  }, [user, boardId, workspaceId, toast]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination || !columns) return;


    if (type === 'COLUMN') {
        const orderedColumns = Object.values(columns).sort((a,b) => a.order - b.order);
        const [movedColumn] = orderedColumns.splice(source.index, 1);
        orderedColumns.splice(destination.index, 0, movedColumn);

        const newColumnsState = { ...columns };
        const batch = writeBatch(db);
        orderedColumns.forEach((col, index) => {
            newColumnsState[col.id].order = index;
            batch.update(doc(db, `workspaces/${workspaceId}/groups`, col.id), { order: index });
        });
        setColumns(newColumnsState);
        await batch.commit();
        return;
    }
    
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const startColumn = columns[sourceColId];
    const endColumn = columns[destColId];
    
    if (!startColumn || !endColumn) return;
    
    const sourceItems = [...startColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);

    const newColumns = { ...columns };
    const batch = writeBatch(db);

    if (sourceColId === destColId) {
      sourceItems.splice(destination.index, 0, removed);
      newColumns[sourceColId] = { ...startColumn, items: sourceItems };
      
      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });

    } else {
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumns[sourceColId] = { ...startColumn, items: sourceItems };
      newColumns[destColId] = { ...endColumn, items: destItems };
      
      const movedTaskRef = doc(db, `workspaces/${workspaceId}/tasks`, removed.id);
      batch.update(movedTaskRef, { groupId: destColId, order: destination.index });

      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });
      destItems.forEach((item, index) => {
         const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, item.id);
         batch.update(taskRef, { order: index });
      });
    }

    setColumns(newColumns);
    try {
        await batch.commit();
    } catch (error) {
        console.error("Failed to reorder tasks:", error);
        toast({ variant: 'destructive', title: 'Failed to save new order' });
        setColumns(columns);
    }
  };
  
  const handleTaskDeleted = (taskId: string) => {
      setSelectedTask(null);
  }


  if (loading || !columns) {
    return <BoardSkeleton />;
  }
  
  const filteredColumns = Object.fromEntries(
    Object.entries(columns).map(([columnId, column]) => [
        columnId,
        {
            ...column,
            items: column.items.filter(item => {
                const searchMatch = item.content.toLowerCase().includes(searchTerm.toLowerCase());
                
                const assigneeMatch = selectedAssignees.length === 0 || 
                    item.assignees?.some(assignee => selectedAssignees.includes(assignee));

                const labelMatch = selectedLabels.length === 0 ||
                    selectedLabels.every(label => item.tags?.includes(label));
                
                return searchMatch && assigneeMatch && labelMatch;
            })
        }
    ])
  );

  const orderedColumns = Object.values(filteredColumns).sort((a,b) => a.order - b.order);

  const handleAssigneeSelect = (assigneeId: string) => {
    setSelectedAssignees(prev => 
        prev.includes(assigneeId) 
        ? prev.filter(id => id !== assigneeId) 
        : [...prev, assigneeId]
    );
  };

  const handleLabelSelect = (label: string) => {
    setSelectedLabels(prev => 
        prev.includes(label) 
        ? prev.filter(l => l !== label) 
        : [...prev, label]
    );
  };

  return (
      <>
        <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-1">
                            <span>Assignee</span>
                            {selectedAssignees.length > 0 && <Badge variant="secondary">{selectedAssignees.length}</Badge>}
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                        className="p-0 w-64 z-50 pointer-events-auto"
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                        onTouchStartCapture={(e) => e.stopPropagation()}
                        >
                        <Command>
                            <CommandInput placeholder="Filter assignees..." />
                            <CommandList>
                                <CommandEmpty>No assignees found.</CommandEmpty>
                                <CommandGroup>
                                    {boardMembers.map(member => (
                                        <CommandItem 
                                            key={member.uid} 
                                            value={member.uid}
                                            onSelect={() => handleAssigneeSelect(member.uid)}
                                            className="cursor-pointer"
                                        >
                                            <Checkbox className="mr-2 pointer-events-none" checked={selectedAssignees.includes(member.uid)} />
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
                            <span>Label</span>
                             {selectedLabels.length > 0 && <Badge variant="secondary">{selectedLabels.length}</Badge>}
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </PopoverTrigger>
                     <PopoverContent 
                        className="p-0 w-64 z-50 pointer-events-auto"
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                        onTouchStartCapture={(e) => e.stopPropagation()}
                        >
                        <Command>
                            <CommandInput placeholder="Filter labels..." />
                            <CommandList>
                                <CommandEmpty>No labels found.</CommandEmpty>
                                <CommandGroup>
                                    {allLabels.map(label => (
                                        <CommandItem 
                                            key={label}
                                            value={label}
                                            onSelect={() => handleLabelSelect(label)}
                                            className="cursor-pointer"
                                        >
                                            <Checkbox 
                                              className="mr-2 pointer-events-none"
                                              checked={selectedLabels.includes(label)} 
                                            />
                                            <span>{label}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {(selectedAssignees.length > 0 || selectedLabels.length > 0) && (
                    <Button variant="ghost" onClick={() => { setSelectedAssignees([]); setSelectedLabels([]); }}>
                        Clear filters
                    </Button>
                )}
             </div>
            <div className="flex items-center gap-2">
                <BoardMembersDialog workspaceId={workspaceId} boardId={boardId} boardMembers={boardMembers} />
                <CreateGroupDialog 
                    workspaceId={workspaceId}
                    boardId={boardId}
                    columnCount={orderedColumns.length}
                />
            </div>
        </div>
        {selectedTask && (
            <TaskDetailsDrawer 
                task={selectedTask} 
                workspaceId={workspaceId}
                boardMembers={boardMembers}
                isOpen={!!selectedTask} 
                onOpenChange={(open) => !open && setSelectedTask(null)} 
                onDelete={handleTaskDeleted}
            />
        )}
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="board" type="COLUMN" direction="horizontal">
            {(provided) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    className="flex items-start gap-6 h-full overflow-x-auto pb-4"
                >
                {orderedColumns.map((column, index) => (
                    <BoardColumn
                        key={column.id}
                        column={column}
                        index={index}
                        boardMembers={boardMembers}
                        onTaskClick={setSelectedTask}
                        workspaceId={workspaceId}
                        boardId={boardId}
                    />
                ))}
                {provided.placeholder}
                </div>
            )}
            </Droppable>
        </DragDropContext>
    </>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex items-start gap-6 h-full overflow-x-auto pb-4">
      {['To Do', 'In Progress', 'Done'].map((name) => (
        <div key={name} className="shrink-0 w-80">
            <div className="bg-muted/60 rounded-xl p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-8" />
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
            </div>
        </div>
      ))}
    </div>
  )
}

export const DynamicBoard = dynamic(() => Promise.resolve(Board), {
  ssr: false,
  loading: () => <BoardSkeleton />,
});
