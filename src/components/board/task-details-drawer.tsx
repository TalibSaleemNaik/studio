
'use client';

import React from 'react';
import { Loader2, Sparkles, UserPlus, MessageSquare, Trash, Trash2, Calendar, Paperclip, File, UploadCloud, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, collection, orderBy, onSnapshot, query, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from '@/hooks/use-auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { suggestTaskTags } from '@/ai/flows/suggest-task-tags';
import { Badge } from '../ui/badge';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { Progress } from '../ui/progress';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Flag } from 'lucide-react';
import { format } from 'date-fns';
import { Task, ChecklistItem, Comment, BoardMember, Attachment } from './types';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { logActivity } from '@/lib/activity-logger';


const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityConfig = {
    low: { label: 'Low', icon: Flag, color: 'text-gray-500' },
    medium: { label: 'Medium', icon: Flag, color: 'text-yellow-500' },
    high: { label: 'High', icon: Flag, color: 'text-orange-500' },
    urgent: { label: 'Urgent', icon: Flag, color: 'text-red-500' },
};


export function TaskDetailsDrawer({ task, workspaceId, boardId, boardMembers, isOpen, onOpenChange, onDelete }: { task: Task; workspaceId: string; boardId:string; boardMembers: BoardMember[]; isOpen: boolean; onOpenChange: (open: boolean) => void; onDelete: (taskId: string) => void; }) {
    const { user } = useAuth();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [originalTask, setOriginalTask] = React.useState(task);
    const [editedTask, setEditedTask] = React.useState(task);
    const [isGeneratingTags, setIsGeneratingTags] = React.useState(false);
    const [newTag, setNewTag] = React.useState("");
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [newComment, setNewComment] = React.useState("");
    const [isPostingComment, setIsPostingComment] = React.useState(false);
    const [newChecklistItem, setNewChecklistItem] = React.useState("");
    const { toast } = useToast();
    
    const checklistProgress = React.useMemo(() => {
        if (!editedTask.checklist || editedTask.checklist.length === 0) return 0;
        const completedCount = editedTask.checklist.filter(item => item.completed).length;
        return (completedCount / editedTask.checklist.length) * 100;
    }, [editedTask.checklist]);
    
    React.useEffect(() => {
        setEditedTask(task);
        setOriginalTask(task); // Keep track of the original task state
        if (task && workspaceId && boardId) {
            const commentsQuery = query(
                collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks/${task.id}/comments`),
                orderBy('createdAt', 'asc')
            );
            const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
                const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
                setComments(commentsData);
            });
            return () => unsubscribe();
        }
    }, [task, workspaceId, boardId]);

    const handleFieldUpdate = async (field: keyof Task, value: any, logMessage?: string) => {
        if (!task || !user) return;
        
        try {
            const taskRef = doc(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`, task.id);
            await updateDoc(taskRef, { [field]: value });
            if (logMessage) {
                await logActivity(workspaceId, boardId, user, logMessage, task.id);
            }
        } catch (error) {
            console.error(`Failed to update task ${field}:`, error);
            toast({ variant: 'destructive', title: `Failed to update ${field}` });
            // Revert local state on failure
            setEditedTask(originalTask);
        }
    };
    
    const handleBlurUpdate = (field: keyof Task, logTemplate: (oldVal: any, newVal: any) => string) => {
        const oldValue = originalTask[field];
        const newValue = editedTask[field];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            const logMessage = logTemplate(oldValue, newValue);
            handleFieldUpdate(field, newValue, logMessage);
        }
    };
    
    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;
        const oldDate = originalTask.dueDate ? format(asJsDate(originalTask.dueDate), "PPP") : "no date";
        const newDate = format(date, "PPP");
        const logMessage = `set the due date for task "${editedTask.content}" to ${newDate} (from ${oldDate}).`;
        setEditedTask({...editedTask, dueDate: date});
        handleFieldUpdate('dueDate', date, logMessage);
    };

    const getDisplayDate = () => {
        if (!editedTask.dueDate) return null;
        return asJsDate(editedTask.dueDate);
    }

    const handleDelete = async () => {
        try {
            if (!user) throw new Error("User not authenticated.");
            const taskToDelete = { ...editedTask }; // Capture state before deletion
            const batch = writeBatch(db);

            // Delete attachments from Storage
            if (task.attachments) {
                for (const attachment of task.attachments) {
                    const fileRef = ref(storage, attachment.path);
                    await deleteObject(fileRef);
                }
            }
            
            const commentsQuery = query(collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks/${task.id}/comments`));
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach(doc => batch.delete(doc.ref));
            
            batch.delete(doc(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`, task.id));
            
            await batch.commit();
            await logActivity(workspaceId, boardId, user, `deleted task "${taskToDelete.content}".`);


            toast({ title: 'Task deleted successfully' });
            onDelete(task.id);
        } catch (error) {
            console.error("Failed to delete task:", error);
            toast({ variant: 'destructive', title: 'Failed to delete task' });
        }
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
                handleFieldUpdate('tags', newTags, `added AI-suggested labels to task "${editedTask.content}".`);
                setEditedTask({...editedTask, tags: newTags});
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
            const newTags = [...(editedTask.tags || []), newTag.trim()];
            setEditedTask({...editedTask, tags: newTags});
            handleFieldUpdate('tags', arrayUnion(newTag.trim()), `added label "${newTag.trim()}" to task "${editedTask.content}".`);
            setNewTag("");
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!task) return;
        const newTags = editedTask.tags?.filter(t => t !== tagToRemove);
        setEditedTask({...editedTask, tags: newTags});
        handleFieldUpdate('tags', arrayRemove(tagToRemove), `removed label "${tagToRemove}" from task "${editedTask.content}".`);
    };
    
    const toggleAssignee = (uid: string) => {
        const member = boardMembers.find(m => m.uid === uid);
        if (!member) return;

        const currentAssignees = editedTask.assignees || [];
        const isAssigned = currentAssignees.includes(uid);
        const newAssignees = isAssigned
            ? currentAssignees.filter(id => id !== uid)
            : [...currentAssignees, uid];

        const logMessage = isAssigned
            ? `unassigned ${member.displayName} from task "${editedTask.content}".`
            : `assigned ${member.displayName} to task "${editedTask.content}".`;
        
        setEditedTask({...editedTask, assignees: newAssignees});
        handleFieldUpdate('assignees', newAssignees, logMessage);
    };
    
    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;
        setIsPostingComment(true);

        try {
            const commentsCollectionRef = collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks/${task.id}/comments`);
            await addDoc(commentsCollectionRef, {
                content: newComment,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                authorPhotoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
            });
            await logActivity(workspaceId, boardId, user, `commented on task "${editedTask.content}": "${newComment}"`, task.id);
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
            setEditedTask({...editedTask, checklist: newChecklist});
            handleFieldUpdate('checklist', newChecklist, `added checklist item "${newItem.text}" to task "${editedTask.content}".`);
            setNewChecklistItem("");
        }
    };
    
    const toggleChecklistItem = (itemId: string) => {
        const newChecklist = editedTask.checklist?.map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        setEditedTask({...editedTask, checklist: newChecklist});

        const item = editedTask.checklist?.find(i => i.id === itemId);
        if(item){
            const logMessage = item.completed
                ? `unchecked item "${item.text}" in task "${editedTask.content}".`
                : `checked off item "${item.text}" in task "${editedTask.content}".`;
            handleFieldUpdate('checklist', newChecklist, logMessage);
        }
    };

    const handleDeleteChecklistItem = (itemId: string) => {
        const item = editedTask.checklist?.find(i => i.id === itemId);
        const newChecklist = editedTask.checklist?.filter(i => i.id !== itemId);
        setEditedTask({...editedTask, checklist: newChecklist});
        if(item){
            handleFieldUpdate('checklist', newChecklist, `deleted checklist item "${item.text}" from task "${editedTask.content}".`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        setIsUploading(true);
        toast({ title: 'Uploading file...' });

        try {
            const filePath = `tasks/${task.id}/attachments/${uuidv4()}-${file.name}`;
            const storageRef = ref(storage, filePath);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const newAttachment: Attachment = {
                id: uuidv4(),
                name: file.name,
                url: downloadURL,
                path: filePath,
                type: file.type,
                createdAt: serverTimestamp(),
            };

            await handleFieldUpdate('attachments', arrayUnion(newAttachment), `attached file "${file.name}" to task "${editedTask.content}".`);
            setEditedTask(prev => ({...prev, attachments: [...(prev.attachments || []), newAttachment]}));


            toast({ title: 'File uploaded successfully!' });
        } catch (error) {
            console.error("File upload failed:", error);
            toast({ variant: 'destructive', title: 'File upload failed' });
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteAttachment = async (attachmentToDelete: Attachment) => {
        toast({ title: 'Deleting attachment...' });
        try {
            if (!user) throw new Error("User not authenticated.");
            // Delete from storage
            const fileRef = ref(storage, attachmentToDelete.path);
            await deleteObject(fileRef);

            // Remove from Firestore
            await handleFieldUpdate('attachments', arrayRemove(attachmentToDelete), `removed attachment "${attachmentToDelete.name}" from task "${editedTask.content}".`);
            setEditedTask(prev => ({...prev, attachments: prev.attachments?.filter(att => att.id !== attachmentToDelete.id)}));

            toast({ title: 'Attachment deleted.' });
        } catch (error) {
             console.error("Failed to delete attachment:", error);
            toast({ variant: 'destructive', title: 'Failed to delete attachment' });
        }
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
                                onFocus={() => setOriginalTask(editedTask)}
                                onChange={(e) => setEditedTask({...editedTask, content: e.target.value})}
                                onBlur={() => handleBlurUpdate('content', (oldVal, newVal) => `renamed task to "${newVal}" (from "${oldVal}")`)}
                                className="text-lg font-semibold"
                            />
                        </div>

                         <div className='space-y-2'>
                             <Label htmlFor="task-description">Description</Label>
                             <Textarea
                                id="task-description"
                                placeholder="Add a more detailed description..."
                                value={editedTask.description || ''}
                                onFocus={() => setOriginalTask(editedTask)}
                                onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
                                onBlur={() => handleBlurUpdate('description', (oldVal, newVal) => `updated the description for task "${editedTask.content}"`)}
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
                                    onValueChange={(value) => {
                                        const logMessage = `set priority for task "${editedTask.content}" to ${value}.`;
                                        setEditedTask({...editedTask, priority: value as Task['priority']});
                                        handleFieldUpdate('priority', value as Task['priority'], logMessage);
                                    }}
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
                                <Paperclip className="h-5 w-5" />
                                Attachments
                            </h3>
                            <div className="space-y-3">
                                {editedTask.attachments?.map(attachment => (
                                    <div key={attachment.id} className="flex items-center justify-between gap-2 p-2 rounded-md border group">
                                        <div className="flex items-center gap-3 flex-1">
                                            <File className="h-6 w-6 text-muted-foreground" />
                                            <Link href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate">
                                                {attachment.name}
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                <Link href={attachment.url} target="_blank">
                                                    <Download className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Attachment?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete "{attachment.name}"? This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteAttachment(attachment)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Upload a file
                            </Button>
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
                                This action cannot be undone. This will permanently delete this task and all of its attachments.
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


    
    

    