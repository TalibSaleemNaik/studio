
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Loader2, MoreHorizontal, Trash2, Edit, Calendar, Flag, Sparkles, AlertTriangle, X, UserPlus, Share, Check, Users, MessageSquare, Trash, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, addDoc, serverTimestamp, writeBatch, deleteDoc, arrayUnion, arrayRemove, getDoc, getDocs, deleteField } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { suggestTaskTags } from '@/ai/flows/suggest-task-tags';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';


interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  content: string;
  order: number;
  groupId: string;
  description?: string;
  dueDate?: any; // Firestore timestamp or JS Date
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  assignees?: string[]; // Array of user UIDs
  comments?: Comment[];
  checklist?: ChecklistItem[];
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

interface UserProfile {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
}

interface BoardMember extends UserProfile {
  role: 'owner' | 'editor' | 'viewer';
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  createdAt: any; // Firestore Timestamp
}

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityConfig = {
    low: { label: 'Low', icon: Flag, color: 'text-gray-500' },
    medium: { label: 'Medium', icon: Flag, color: 'text-yellow-500' },
    high: { label: 'High', icon: Flag, color: 'text-orange-500' },
    urgent: { label: 'Urgent', icon: Flag, color: 'text-red-500' },
};


function TaskDetailsDrawer({ task, workspaceId, boardMembers, isOpen, onOpenChange, onDelete }: { task: Task; workspaceId: string; boardMembers: BoardMember[]; isOpen: boolean; onOpenChange: (open: boolean) => void; onDelete: (taskId: string) => void; }) {
    const { user } = useAuth();
    const [editedTask, setEditedTask] = React.useState(task);
    const [isGeneratingTags, setIsGeneratingTags] = React.useState(false);
    const [newTag, setNewTag] = React.useState("");
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [newComment, setNewComment] = React.useState("");
    const [isPostingComment, setIsPostingComment] = React.useState(false);
    const [newChecklistItem, setNewChecklistItem] = React.useState("");
    
    const checklistProgress = React.useMemo(() => {
        if (!editedTask.checklist || editedTask.checklist.length === 0) return 0;
        const completedCount = editedTask.checklist.filter(item => item.completed).length;
        return (completedCount / editedTask.checklist.length) * 100;
    }, [editedTask.checklist]);
    
    React.useEffect(() => {
        setEditedTask(task);
        if (task && workspaceId) {
            const commentsQuery = query(
                collection(db, `workspaces/${workspaceId}/tasks/${task.id}/comments`),
                orderBy('createdAt', 'asc')
            );
            const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
                const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
                setComments(commentsData);
            });
            return () => unsubscribe();
        }
    }, [task, workspaceId]);

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
        return asJsDate(editedTask.dueDate);
    }

    const handleDelete = () => {
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
                const currentTags = editedTask.tags || [];
                const newTags = Array.from(new Set([...currentTags, ...result.suggestedTags]));
                handleUpdate('tags', newTags);
            }
        } catch (error) {
            console.error("Failed to generate tags:", error);
            toast({ variant: 'destructive', title: 'AI Suggestion Failed' });
        } finally {
            setIsGeneratingTags(false);
        }
    }

    const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newTag.trim() && task) {
            e.preventDefault();
            const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, task.id);
            await updateDoc(taskRef, {
                tags: arrayUnion(newTag.trim())
            });
            setNewTag("");
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!task) return;
        const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, task.id);
        await updateDoc(taskRef, {
            tags: arrayRemove(tagToRemove)
        });
    };
    
    const toggleAssignee = (uid: string) => {
        const currentAssignees = editedTask.assignees || [];
        const newAssignees = currentAssignees.includes(uid)
            ? currentAssignees.filter(id => id !== uid)
            : [...currentAssignees, uid];
        handleUpdate('assignees', newAssignees);
    };
    
    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;
        setIsPostingComment(true);

        try {
            const commentsCollectionRef = collection(db, `workspaces/${workspaceId}/tasks/${task.id}/comments`);
            await addDoc(commentsCollectionRef, {
                content: newComment,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                authorPhotoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
            });
            setNewComment('');
        } catch (error) {
            console.error("Failed to post comment:", error);
            toast({ variant: 'destructive', title: 'Failed to post comment' });
        } finally {
            setIsPostingComment(false);
        }
    };

    const handleAddChecklistItem = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newChecklistItem.trim()) {
            e.preventDefault();
            const newItem: ChecklistItem = {
                id: new Date().toISOString(),
                text: newChecklistItem.trim(),
                completed: false,
            };
            const newChecklist = [...(editedTask.checklist || []), newItem];
            handleUpdate('checklist', newChecklist);
            setNewChecklistItem("");
        }
    };
    
    const toggleChecklistItem = (itemId: string) => {
        const newChecklist = editedTask.checklist?.map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        handleUpdate('checklist', newChecklist);
    };

    const handleDeleteChecklistItem = (itemId: string) => {
        const newChecklist = editedTask.checklist?.filter(item => item.id !== itemId);
        handleUpdate('checklist', newChecklist);
    };
    

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
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {getDisplayDate() ? format(getDisplayDate()!, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarPicker
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
                        
                         <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Labels</Label>
                                <Button variant="ghost" size="sm" onClick={handleGenerateTags} disabled={isGeneratingTags}>
                                    {isGeneratingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                    AI Suggest
                                </Button>
                            </div>
                             <div className="flex flex-wrap gap-2">
                                {editedTask.tags?.map(tag => (
                                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="rounded-full hover:bg-black/10">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <Input 
                                placeholder="Add a label and press Enter..."
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={handleAddTag}
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <Label>Assignees</Label>
                            <div className="flex items-center gap-2">
                                {boardMembers.filter(member => editedTask.assignees?.includes(member.uid)).map(assignee => (
                                    <Avatar key={assignee.uid} className="h-8 w-8">
                                        <AvatarImage src={assignee.photoURL} alt={assignee.displayName} />
                                        <AvatarFallback>{assignee.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                ))}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-full">
                                            <UserPlus className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0">
                                        <Command>
                                            <CommandInput placeholder="Assign to..." />
                                            <CommandList>
                                                <CommandEmpty>No users found.</CommandEmpty>
                                                <CommandGroup>
                                                    {boardMembers.map(member => (
                                                        <CommandItem
                                                            key={member.uid}
                                                            onSelect={() => toggleAssignee(member.uid)}
                                                        >
                                                            <Checkbox
                                                                className="mr-2"
                                                                checked={editedTask.assignees?.includes(member.uid)}
                                                            />
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
                            </div>
                        </div>

                         <div className="space-y-4">
                            <Label>Checklist</Label>
                            {editedTask.checklist && editedTask.checklist.length > 0 && (
                                <div className="space-y-2">
                                    <Progress value={checklistProgress} className="h-2" />
                                    {editedTask.checklist.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 group">
                                            <Checkbox
                                                id={`checklist-${item.id}`}
                                                checked={item.completed}
                                                onCheckedChange={() => toggleChecklistItem(item.id)}
                                            />
                                            <label
                                                htmlFor={`checklist-${item.id}`}
                                                className={cn("flex-1 text-sm", item.completed && "line-through text-muted-foreground")}
                                            >
                                                {item.text}
                                            </label>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                                onClick={() => handleDeleteChecklistItem(item.id)}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Input
                                placeholder="Add a checklist item and press Enter..."
                                value={newChecklistItem}
                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                onKeyDown={handleAddChecklistItem}
                            />
                        </div>


                         <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Activity
                            </h3>
                            <div className="space-y-4">
                                {comments.map(comment => (
                                    <div key={comment.id} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={comment.authorPhotoURL} alt={comment.authorName} />
                                            <AvatarFallback>{comment.authorName?.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-baseline gap-2">
                                                <p className="font-semibold">{comment.authorName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                     {comment.createdAt ? format(asJsDate(comment.createdAt), 'PP p') : '...'}
                                                </p>
                                            </div>
                                            <div className="mt-1 rounded-md bg-muted/50 p-3 text-sm">
                                                <p>{comment.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handlePostComment} className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                                    <AvatarFallback>{user?.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className='flex-1'>
                                    <Input 
                                        placeholder="Write a comment..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        disabled={isPostingComment}
                                    />
                                     <Button type="submit" size="sm" className="mt-2" disabled={isPostingComment || !newComment.trim()}>
                                        {isPostingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Comment
                                    </Button>
                                </div>
                            </form>
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
                        const userData = docSnap.data() as Omit<UserProfile, 'uid'>;
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
  
  const handleDeleteTask = async (taskId: string) => {
      try {
        const commentsQuery = query(collection(db, `workspaces/${workspaceId}/tasks/${taskId}/comments`));
        const commentsSnapshot = await getDocs(commentsQuery);
        const batch = writeBatch(db);
        commentsSnapshot.forEach(doc => batch.delete(doc.ref));
        
        batch.delete(doc(db, `workspaces/${workspaceId}/tasks`, taskId));
        
        await batch.commit();

        toast({ title: 'Task deleted successfully' });
        setSelectedTask(null);
      } catch (error) {
        console.error("Failed to delete task:", error);
        toast({ variant: 'destructive', title: 'Failed to delete task' });
      }
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
                    <PopoverContent className="p-0 w-64">
                        <Command>
                            <CommandInput placeholder="Filter assignees..." />
                            <CommandList>
                                <CommandEmpty>No assignees found.</CommandEmpty>
                                <CommandGroup>
                                    {boardMembers.map(member => (
                                        <CommandItem key={member.uid} onSelect={() => handleAssigneeSelect(member.uid)}>
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
                            <span>Label</span>
                             {selectedLabels.length > 0 && <Badge variant="secondary">{selectedLabels.length}</Badge>}
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </PopoverTrigger>
                     <PopoverContent className="p-0 w-64">
                        <Command>
                            <CommandInput placeholder="Filter labels..." />
                            <CommandList>
                                <CommandEmpty>No labels found.</CommandEmpty>
                                <CommandGroup>
                                    {allLabels.map(label => (
                                        <CommandItem 
                                            key={label}
                                            onSelect={() => handleLabelSelect(label)}
                                        >
                                            <Checkbox className="mr-2 pointer-events-none" checked={selectedLabels.includes(label)} />
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
            <BoardMembersDialog workspaceId={workspaceId} boardId={boardId} boardMembers={boardMembers} />
        </div>
        {selectedTask && (
            <TaskDetailsDrawer 
                task={selectedTask} 
                workspaceId={workspaceId}
                boardMembers={boardMembers}
                isOpen={!!selectedTask} 
                onOpenChange={(open) => !open && setSelectedTask(null)} 
                onDelete={handleDeleteTask}
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
                                                                            <Calendar className='h-3 w-3' />
                                                                            <span>{format(asJsDate(item.dueDate), 'MMM d')}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.priority && priorityConfig[item.priority] && (() => {
                                                                        const { icon: Icon, color } = priorityConfig[item.priority];
                                                                        return <Icon className={cn('h-4 w-4', color)} />;
                                                                    })()}
                                                                </div>
                                                                <div className="flex -space-x-2 overflow-hidden">
                                                                    {item.assignees?.map(uid => {
                                                                        const member = boardMembers.find(m => m.uid === uid);
                                                                        return (
                                                                            <Avatar key={uid} className="h-6 w-6 border-2 border-card">
                                                                                <AvatarImage src={member?.photoURL} />
                                                                                <AvatarFallback>{member?.displayName?.charAt(0) || '?'}</AvatarFallback>
                                                                            </Avatar>
                                                                        )
                                                                    })}
                                                                </div>
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
