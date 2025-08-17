
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  content: string;
  order: number;
}

interface Column {
  id: string;
  name: string;
  items: Task[];
  order: number;
}

interface Columns {
  [key: string]: Column;
}

function CreateGroupDialog({ workspaceId, boardId, onGroupCreated, columnCount }: { workspaceId: string, boardId: string, onGroupCreated: () => void, columnCount: number }) {
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'List name cannot be empty' });
            return;
        }
        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workspaceId}/groups`), {
                boardId: boardId,
                name: name,
                order: columnCount,
                createdAt: serverTimestamp(),
            });

            toast({ title: "List created successfully!" });
            setName('');
            setIsOpen(false);
            onGroupCreated();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create list", description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" /> Add New List
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateGroup}>
                    <DialogHeader>
                        <DialogTitle>Create New List</DialogTitle>
                        <DialogDescription>
                            Give your new list a name.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backlog" className="col-span-3" disabled={isCreating} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create List'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function CreateTaskDialog({ workspaceId, boardId, groupId, onTaskCreated, columnItemCount }: { workspaceId: string, boardId: string, groupId: string, onTaskCreated: () => void, columnItemCount: number }) {
    const [content, setContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            toast({ variant: 'destructive', title: 'Task content cannot be empty' });
            return;
        }
        setIsCreating(true);
        try {
            await addDoc(collection(db, `workspaces/${workspaceId}/tasks`), {
                boardId: boardId,
                groupId: groupId,
                content: content,
                order: columnItemCount, // Add to the bottom of the list
                createdAt: serverTimestamp(),
            });

            toast({ title: "Task created successfully!" });
            setContent('');
            setIsOpen(false);
            onTaskCreated();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create task", description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="ghost" className="w-full mt-2 justify-start">
                  <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateTask}>
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                            Add a new task to this column.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="content" className="text-right pt-2">
                                Task
                            </Label>
                            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. Design the login page" className="col-span-3" disabled={isCreating} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


function Board({ boardId }: { boardId: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);

  // Hardcoded workspaceId for now. This should come from user context or props.
  const workspaceId = 'default-workspace';

  useEffect(() => {
    // Wait until we have a user and a boardId.
    if (!user || !boardId || !workspaceId) {
        // Keep showing loader if we are not ready
        setLoading(true);
        return;
    }

    setLoading(true);

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
        const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { content: string; groupId: string; order: number } }));

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

    return () => unsubscribeGroups();

  }, [user, boardId, workspaceId]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;

    if (type === 'COLUMN') {
        const orderedColumns = Object.values(columns).sort((a,b) => a.order - b.order);
        const [movedColumn] = orderedColumns.splice(source.index, 1);
        orderedColumns.splice(destination.index, 0, movedColumn);

        const newColumnsState = { ...columns };
        orderedColumns.forEach((col, index) => {
            newColumnsState[col.id].order = index;
        });
        setColumns(newColumnsState);

        for (let i = 0; i < orderedColumns.length; i++) {
            await updateDoc(doc(db, `workspaces/${workspaceId}/groups`, orderedColumns[i].id), { order: i });
        }
        return;
    }
    
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const startColumn = columns[sourceColId];
    const endColumn = columns[destColId];
    
    if (!startColumn || !endColumn) return;
    
    const sourceItems = [...startColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);

    // Update local state immediately for better UX
    const newColumns = { ...columns };

    if (sourceColId === destColId) {
      // Moving within the same column
      sourceItems.splice(destination.index, 0, removed);
      newColumns[sourceColId] = {
        ...startColumn,
        items: sourceItems
      };
      setColumns(newColumns);
      
      // Update order in Firestore
      for (let i = 0; i < sourceItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, sourceItems[i].id), { order: i });
      }

    } else {
      // Moving to a different column
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumns[sourceColId] = { ...startColumn, items: sourceItems };
      newColumns[destColId] = { ...endColumn, items: destItems };
      setColumns(newColumns);

      // Update groupId and order for the moved task
      await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, removed.id), {
        groupId: destColId,
        order: destination.index, 
      });

      // Update order in source column
      for (let i = 0; i < sourceItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, sourceItems[i].id), { order: i });
      }

      // Update order in destination column
       for (let i = 0; i < destItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, destItems[i].id), { order: i });
      }
    }
  };

  if (loading) {
    return <BoardSkeleton />;
  }
  
  const orderedColumns = Object.values(columns).sort((a,b) => a.order - b.order);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="COLUMN" direction="horizontal">
          {(provided) => (
            <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className="flex items-start gap-6 h-full overflow-x-auto pb-4"
            >
              {orderedColumns.map((column, index) => (
                <Draggable key={column.id} draggableId={column.id} index={index}>
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="shrink-0 w-80"
                        >
                            <div 
                                {...provided.dragHandleProps}
                                className="bg-muted/60 rounded-xl p-4 h-full flex flex-col"
                            >
                                <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-foreground/90">{column.name}</h2>
                                <span className="text-sm font-medium bg-muted px-2 py-1 rounded-md">{column.items.length}</span>
                                </div>
                                <Droppable key={column.id} droppableId={column.id} type="TASK">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            "flex-1 flex flex-col transition-colors rounded-lg",
                                            snapshot.isDraggingOver && "bg-primary/10"
                                        )}
                                    >
                                        <div className='flex-1 space-y-4 overflow-y-auto pr-2 -mr-2 min-h-[1px]'>
                                            {column.items.map((item, index) => (
                                                <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={cn(
                                                        "bg-card p-4 rounded-lg shadow-sm border flex items-start gap-3 transition-shadow",
                                                        snapshot.isDragging && "shadow-lg"
                                                    )}
                                                    style={{
                                                        ...provided.draggableProps.style
                                                    }}
                                                    >
                                                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                                                    <div className="flex-1">
                                                        <p className="font-medium">{item.content}</p>
                                                    </div>
                                                    </div>
                                                )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                        <CreateTaskDialog 
                                            workspaceId={workspaceId} 
                                            boardId={boardId} 
                                            groupId={column.id}
                                            columnItemCount={column.items.length}
                                            onTaskCreated={() => {}}
                                        />
                                    </div>
                                )}
                                </Droppable>
                            </div>
                        </div>
                    )}
                </Draggable>
              ))}
              {provided.placeholder}
              <div className="shrink-0 w-80">
                <CreateGroupDialog 
                    workspaceId={workspaceId}
                    boardId={boardId}
                    columnCount={orderedColumns.length}
                    onGroupCreated={() => {}}
                />
              </div>
            </div>
          )}
        </Droppable>
    </DragDropContext>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex items-start gap-6 h-full overflow-x-auto pb-4">
      {['To Do', 'In Progress', 'Done'].map((name) => (
        <div key={name} className="shrink-0 w-80">
            <div className="bg-muted/60 rounded-xl p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-foreground/90">{name}</h2>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
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

    