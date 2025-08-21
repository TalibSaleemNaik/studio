
'use client';

import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical, MoreHorizontal, Plus, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, getDocs, query } from 'firebase/firestore';
import { Task, Column, BoardMember } from './types';
import { TaskCard } from './task-card';
import { CreateTaskDialog } from './create-task-dialog';


function ColumnMenu({ column, workspaceId, boardId }: { column: Column, workspaceId: string, boardId: string}) {
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
            await updateDoc(doc(db, `workspaces/${workspaceId}/boards/${boardId}/groups`, column.id), { name: newName });
            toast({ title: "List renamed" });
            setIsRenameOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to rename list' });
        }
    }

    const handleDelete = async () => {
        const batch = writeBatch(db);
        
        // Delete the group itself
        batch.delete(doc(db, `workspaces/${workspaceId}/boards/${boardId}/groups`, column.id));

        // Delete all tasks within that group
        const tasksQuery = query(collection(db, `workspaces/${workspaceId}/boards/${boardId}/tasks`), where('groupId', '==', column.id));
        const tasksSnapshot = await getDocs(tasksQuery);
        tasksSnapshot.forEach(taskDoc => {
            batch.delete(taskDoc.ref);
        });

        try {
            await batch.commit();
            toast({ title: "List deleted" });
        } catch (error) {
            console.error(error);
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


export function BoardColumn({ column, index, boardMembers, onTaskClick, workspaceId, boardId }: { column: Column; index: number; boardMembers: BoardMember[]; onTaskClick: (task: Task) => void; workspaceId: string; boardId: string; }) {
    return (
        <Draggable draggableId={column.id} index={index}>
            {(provided) => (
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
                                        'flex-1 space-y-4 overflow-y-auto pr-2 -mr-2 min-h-[1px]',
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
                                    <CreateTaskDialog
                                        workspaceId={workspaceId}
                                        boardId={boardId}
                                        groupId={column.id}
                                        columnItemCount={column.items.length}
                                    />
                                </div>
                            )}
                        </Droppable>
                    </div>
                </div>
            )}
        </Draggable>
    );
}

    