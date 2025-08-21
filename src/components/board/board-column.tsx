
'use client';

import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Task, Column, BoardMember } from './types';
import { TaskCard } from './task-card';
import { useAuth } from '@/hooks/use-auth';
import { logActivity, SimpleUser } from '@/lib/activity-logger';


function ColumnMenu({ column, workspaceId, boardId }: { column: Column, workspaceId: string, boardId: string}) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isRenameOpen, setIsRenameOpen] = React.useState(false);
    const [newName, setNewName] = React.useState(column.name);
    const [originalName, setOriginalName] = React.useState(column.name);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || newName === column.name || !user) {
            setIsRenameOpen(false);
            return;
        }
        try {
            await updateDoc(doc(db, `workspaces/${workspaceId}/boards/${boardId}/groups`, column.id), { name: newName });
             if (user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workspaceId, boardId, simpleUser, `renamed list to "${newName}" (from "${originalName}")`);
            }
            toast({ title: "List renamed" });
            setOriginalName(newName);
            setIsRenameOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to rename list' });
        }
    }

    const handleDelete = async () => {
        if (!user) return;
        setIsDeleting(true);
        const batch = writeBatch(db);
        
        // Delete the group itself
        batch.delete(doc(db, `workspaces/${workspaceId}/boards/${boardId}/groups`, column.id));

        // Delete all tasks within that group
        const tasksQuery = query(collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`), where('groupId', '==', column.id));
        
        try {
            const tasksSnapshot = await getDocs(tasksQuery);
            tasksSnapshot.forEach(taskDoc => {
                batch.delete(taskDoc.ref);
            });
            await batch.commit();

            if (user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workspaceId, boardId, simpleUser, `deleted list "${column.name}"`);
            }
            toast({ title: "List deleted" });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to delete list' });
        } finally {
            setIsDeleting(false);
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
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function QuickAdd({ column, workspaceId, boardId }: { column: Column, workspaceId: string, boardId: string }) {
    const [content, setContent] = React.useState('');
    const { toast } = useToast();
    const { user } = useAuth();

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !user) {
            return;
        }
        
        try {
            const taskRef = await addDoc(collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`), {
                groupId: column.id,
                content: content,
                order: column.items.length,
                createdAt: serverTimestamp(),
            });

            if(user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workspaceId, boardId, simpleUser, `created task "${content}"`, taskRef.id);
            }
            setContent('');
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create task", description: error.message });
        } 
    };

    return (
        <form onSubmit={handleCreateTask}>
            <div className="relative mt-2">
                <Input 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Quick add..."
                    className="bg-background/50 pr-8"
                />
                 <Button type="submit" size="icon" variant="ghost" className="absolute right-0 top-0 h-full w-10 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </form>
    )
}

const columnColors = [
    'bg-sky-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
];

export function BoardColumn({ column, index, boardMembers, onTaskClick, workspaceId, boardId }: { column: Column; index: number; boardMembers: BoardMember[]; onTaskClick: (task: Task) => void; workspaceId: string; boardId: string; }) {
    const color = columnColors[index % columnColors.length];
    
    return (
        <Draggable draggableId={column.id} index={index}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="shrink-0 w-80"
                >
                    <div className="bg-muted/30 rounded-lg p-3 h-full flex flex-col">
                        <div
                            {...provided.dragHandleProps}
                            className="flex justify-between items-center mb-4 "
                        >
                            <div className='flex items-center gap-3'>
                                <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                                <h2 className="text-md font-semibold text-foreground/90">{column.name}</h2>
                                <span className="text-sm font-medium bg-background px-2 py-0.5 rounded-md text-muted-foreground">{column.items.length}</span>
                            </div>
                            <ColumnMenu column={column} workspaceId={workspaceId} boardId={boardId} />
                        </div>
                        <Droppable droppableId={column.id} type="TASK">
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "flex-1 flex flex-col transition-colors rounded-lg",
                                    )}
                                >
                                    <div className={cn(
                                        'flex-1 space-y-3 overflow-y-auto pr-2 -mr-3 min-h-[1px]',
                                        snapshot.isDraggingOver && "bg-primary/10 rounded-lg"
                                    )}>
                                        {column.items.map((item, index) => (
                                            <TaskCard
                                                key={item.id}
                                                task={item}
                                                index={index}
                                                boardMembers={boardMembers}
                                                onClick={() => onTaskClick(item)}
                                            />
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                    <QuickAdd column={column} workspaceId={workspaceId} boardId={boardId} />
                                </div>
                            )}
                        </Droppable>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
