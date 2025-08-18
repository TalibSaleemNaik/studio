
'use client';

import React, from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Loader2, MoreHorizontal, Trash2, Edit, CalendarIcon, Flag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, addDoc, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Task {
  id: string;
  content: string;
  order: number;
  description?: string;
  dueDate?: any; // Firestore timestamp
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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

const priorityConfig = {
    low: { label: 'Low', icon: Flag, color: 'text-gray-500' },
    medium: { label: 'Medium', icon: Flag, color: 'text-yellow-500' },
    high: { label: 'High', icon: Flag, color: 'text-orange-500' },
    urgent: { label: 'Urgent', icon: Flag, color: 'text-red-500' },
};


function TaskDetailsDrawer({ task, workspaceId, isOpen, onOpenChange }: { task: Task | null; workspaceId: string; isOpen: boolean; onOpenChange: (open: boolean) => void; }) {
    const [editedTask, setEditedTask] = React.useState(task);
    const { toast } = useToast();
    
    React.useEffect(() => {
        setEditedTask(task);
    }, [task]);

    if (!editedTask) return null;

    const handleUpdate = async (field: keyof Task, value: any) => {
        if (!task) return;
        const updatedTask = { ...editedTask, [field]: value };
        setEditedTask(updatedTask); // Optimistic update of local state

        try {
            const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, task.id);
            await updateDoc(taskRef, { [field]: value });
        } catch (error) {
            console.error("Failed to update task:", error);
            toast({ variant: 'destructive', title: 'Failed to update task' });
            setEditedTask(task); // Revert on failure
        }
    };
    
    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;
        handleUpdate('dueDate', date);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-[500px] sm:w-[540px] flex flex-col">
                <SheetHeader>
                    <SheetTitle>Task Details</SheetTitle>
                    <SheetDescription>
                        Edit the details of your task. Changes are saved automatically.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto pr-4 -mr-4">
                    <div className="space-y-6 py-4">
                        <div className='space-y-2'>
                             <Label htmlFor="task-title">Title</Label>
                             <Input 
                                id="task-title"
                                value={editedTask.content}
                                onChange={(e) => setEditedTask({...editedTask, content: e.target.value})}
                                onBlur={() => handleUpdate('content', editedTask.content)}
                                className="text-lg font-semibold"
                            />
                        </div>

                         <div className='space-y-2'>
                             <Label htmlFor="task-description">Description</Label>
                             <Textarea
                                id="task-description"
                                placeholder="Add a more detailed description..."
                                value={editedTask.description || ''}
                                onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
                                onBlur={() => handleUpdate('description', editedTask.description)}
                                rows={6}
                             />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className='space-y-2'>
                                <Label>Due Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editedTask.dueDate && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {editedTask.dueDate ? format(editedTask.dueDate.toDate(), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={editedTask.dueDate?.toDate()}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className='space-y-2'>
                                <Label>Priority</Label>
                                <Select
                                    value={editedTask.priority}
                                    onValueChange={(value) => handleUpdate('priority', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Set priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(priorityConfig).map(([key, {label, icon: Icon}]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    <span>{label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function CreateGroupDialog({ workspaceId, boardId, onGroupCreated, columnCount }: { workspaceId: string, boardId: string, onGroupCreated: () => void, columnCount: number }) {
    const [name, setName] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
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
    const [content, setContent] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
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

function ColumnMenu({ column, workspaceId }: { column: Column, workspaceId: string}) {
    const { toast } = useToast();
    const [isRenameOpen, setIsRenameOpen] = React.useState(false);
    const [newName, setNewName] = React.useState(column.name);

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || newName === column.name) {
            setIsRenameOpen(false);
            return;
        }
        try {
            await updateDoc(doc(db, `workspaces/${workspaceId}/groups`, column.id), { name: newName });
            toast({ title: "List renamed" });
            setIsRenameOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to rename list' });
        }
    }

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete "${column.name}" and all its tasks? This action cannot be undone.`)) return;

        const batch = writeBatch(db);
        batch.delete(doc(db, `workspaces/${workspaceId}/groups`, column.id));
        column.items.forEach(task => {
            batch.delete(doc(db, `workspaces/${workspaceId}/tasks`, task.id));
        });

        try {
            await batch.commit();
            toast({ title: "List deleted" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to delete list' });
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setIsRenameOpen(true)}>
                        <Edit className="mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                        <Trash2 className="mr-2" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <form onSubmit={handleRename}>
                        <DialogHeader>
                            <DialogTitle>Rename List</DialogTitle>
                        </DialogHeader>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="my-4" />
                        <DialogFooter>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}

function Board({ boardId }: { boardId: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = React.useState<Columns | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  // Hardcoded workspaceId for now. This should come from user context or props.
  const workspaceId = 'default-workspace';

  React.useEffect(() => {
    // Wait until we have a user and a boardId.
    if (!user || !boardId || !workspaceId) {
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
        const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Task }));

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
        if(item.order !== index) {
            batch.update(doc(db, `workspaces/${workspaceId}/tasks`, item.id), { order: index });
        }
      });

    } else {
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumns[sourceColId] = { ...startColumn, items: sourceItems };
      newColumns[destColId] = { ...endColumn, items: destItems };
      
      batch.update(doc(db, `workspaces/${workspaceId}/tasks`, removed.id), {
        groupId: destColId,
        order: destination.index, 
      });

      sourceItems.forEach((item, index) => {
         if(item.order !== index) {
            batch.update(doc(db, `workspaces/${workspaceId}/tasks`, item.id), { order: index });
        }
      });
      destItems.forEach((item, index) => {
        if(item.order !== index) {
            batch.update(doc(db, `workspaces/${workspaceId}/tasks`, item.id), { order: index });
        }
      });
    }

    setColumns(newColumns);
    await batch.commit();
  };

  if (loading || !columns) {
    return <BoardSkeleton />;
  }
  
  const orderedColumns = Object.values(columns).sort((a,b) => a.order - b.order);

  return (
      <>
        <TaskDetailsDrawer 
            task={selectedTask} 
            workspaceId={workspaceId} 
            isOpen={!!selectedTask} 
            onOpenChange={(open) => !open && setSelectedTask(null)} 
        />
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
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="shrink-0 w-80"
                            >
                                <div className="bg-muted/60 rounded-xl p-4 h-full flex flex-col">
                                    <div 
                                        {...provided.dragHandleProps}
                                        className="flex justify-between items-center mb-4 "
                                    >
                                        <div className='flex items-center gap-2'>
                                            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                            <h2 className="text-lg font-semibold text-foreground/90">{column.name}</h2>
                                            <span className="text-sm font-medium bg-muted px-2 py-1 rounded-md">{column.items.length}</span>
                                        </div>
                                        <ColumnMenu column={column} workspaceId={workspaceId} />
                                    </div>
                                    <Droppable key={column.id} droppableId={column.id} type="TASK">
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn(
                                                "flex-1 flex flex-col transition-colors rounded-lg",
                                            )}
                                        >
                                            <div className={cn(
                                                'flex-1 space-y-4 overflow-y-auto pr-2 -mr-2 min-h-[1px]',
                                                snapshot.isDraggingOver && "bg-primary/10 rounded-lg"
                                            )}>
                                                {column.items.map((item, index) => (
                                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onClick={() => setSelectedTask(item)}
                                                        className={cn(
                                                            "bg-card p-4 rounded-lg shadow-sm border flex flex-col gap-3 transition-shadow cursor-pointer",
                                                            snapshot.isDragging && "shadow-lg"
                                                        )}
                                                        style={{
                                                            ...provided.draggableProps.style
                                                        }}
                                                        >
                                                            <p className="font-medium">{item.content}</p>
                                                            <div className='flex justify-between items-center text-muted-foreground'>
                                                                <div className='flex items-center gap-2'>
                                                                    {item.dueDate && (
                                                                        <div className='flex items-center gap-1 text-xs'>
                                                                            <CalendarIcon className='h-3 w-3' />
                                                                            <span>{format(item.dueDate.toDate(), 'MMM d')}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.priority && priorityConfig[item.priority] && (() => {
                                                                        const { icon: Icon, color } = priorityConfig[item.priority];
                                                                        return <Icon className={cn('h-4 w-4', color)} />;
                                                                    })()}
                                                                </div>
                                                                {/* Placeholder for Assignee Avatar */}
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
