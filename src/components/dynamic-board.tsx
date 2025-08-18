
'use client';

import React, from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Loader2, MoreHorizontal, Trash2, Edit, CalendarIcon, Flag, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, addDoc, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
import { suggestTaskTags } from '@/ai/flows/suggest-task-tags';
import { Badge } from './ui/badge';

interface Task {
  id: string;
  content: string;
  order: number;
  groupId: string;
  description?: string;
  dueDate?: any; // Firestore timestamp or JS Date
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
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


function TaskDetailsDrawer({ task, workspaceId, isOpen, onOpenChange, onDelete }: { task: Task | null; workspaceId: string; isOpen: boolean; onOpenChange: (open: boolean) => void; onDelete: (taskId: string) => void; }) {
    const [editedTask, setEditedTask] = React.useState(task);
    const [isGeneratingTags, setIsGeneratingTags] = React.useState(false);
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

    const getDisplayDate = () => {
        if (!editedTask.dueDate) return null;
        // Check if it's a Firestore Timestamp
        if (typeof editedTask.dueDate.toDate === 'function') {
            return editedTask.dueDate.toDate(); 
        }
        // Otherwise, it's already a JS Date
        return editedTask.dueDate; 
    }

    const handleDelete = () => {
        if (!task) return;
        onDelete(task.id);
    }
    
    const handleGenerateTags = async () => {
        setIsGeneratingTags(true);
        try {
            const result = await suggestTaskTags({
                title: editedTask.content,
                description: editedTask.description,
            });
            if (result.suggestedTags) {
                handleUpdate('tags', Array.from(new Set([...(editedTask.tags || []), ...result.suggestedTags])));
            }
        } catch (error) {
            console.error("Failed to generate tags:", error);
            toast({ variant: 'destructive', title: 'AI Suggestion Failed' });
        } finally {
            setIsGeneratingTags(false);
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full max-w-2xl flex flex-col">
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
                                            {getDisplayDate() ? format(getDisplayDate()!, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={getDisplayDate() ?? undefined}
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
                                    onValueChange={(value) => handleUpdate('priority', value as Task['priority'])}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Set priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">
                                            <div className="flex items-center gap-2">
                                                <Flag className={cn("h-4 w-4", priorityConfig.low.color)} />
                                                <span>{priorityConfig.low.label}</span>
                                            </div>
                                        </SelectItem>
                                         <SelectItem value="medium">
                                            <div className="flex items-center gap-2">
                                                <Flag className={cn("h-4 w-4", priorityConfig.medium.color)} />
                                                <span>{priorityConfig.medium.label}</span>
                                            </div>
                                        </SelectItem>
                                         <SelectItem value="high">
                                            <div className="flex items-center gap-2">
                                                <Flag className={cn("h-4 w-4", priorityConfig.high.color)} />
                                                <span>{priorityConfig.high.label}</span>
                                            </div>
                                        </SelectItem>
                                         <SelectItem value="urgent">
                                            <div className="flex items-center gap-2">
                                                <Flag className={cn("h-4 w-4", priorityConfig.urgent.color)} />
                                                <span>{priorityConfig.urgent.label}</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Tags</Label>
                                <Button variant="ghost" size="sm" onClick={handleGenerateTags} disabled={isGeneratingTags}>
                                    {isGeneratingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                    AI Suggest
                                </Button>
                            </div>
                             <div className="flex flex-wrap gap-2">
                                {editedTask.tags?.map(tag => (
                                    <Badge key={tag} variant="secondary">{tag}</Badge>
                                ))}
                                {(!editedTask.tags || editedTask.tags.length === 0) && (
                                    <p className='text-sm text-muted-foreground'>No tags yet.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
                <SheetFooter className='border-t pt-4'>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className='mr-auto'>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Task
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this task.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <SheetClose asChild>
                        <Button>Close</Button>
                    </SheetClose>
                </SheetFooter>
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
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

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
        } finally {
            setIsConfirmOpen(false);
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
                        <Edit className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => setIsConfirmOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
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
                            <Button type="button" variant="secondary" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

             <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                             <AlertDialogDescription>
                               This will delete the list "{column.name}" and all of its tasks. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function Board({ boardId }: { boardId: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = React.useState<Columns | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const { toast } = useToast();

  const workspaceId = 'default-workspace';

  React.useEffect(() => {
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
  
  const handleDeleteTask = async (taskId: string) => {
      try {
        await deleteDoc(doc(db, `workspaces/${workspaceId}/tasks`, taskId));
        toast({ title: 'Task deleted successfully' });
        setSelectedTask(null); // Close the drawer
      } catch (error) {
        console.error("Failed to delete task:", error);
        toast({ variant: 'destructive', title: 'Failed to delete task' });
      }
  }


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
            onDelete={handleDeleteTask}
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
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.tags?.map(tag => (
                                                                    <Badge key={tag} variant="secondary" className='text-xs'>{tag}</Badge>
                                                                ))}
                                                            </div>
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
