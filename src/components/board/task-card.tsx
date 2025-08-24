
'use client';

import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Task, BoardMember } from './types';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Progress } from '../ui/progress';

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityConfig = {
    low: 'bg-gradient-to-br from-green-400 to-sky-400',
    medium: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    high: 'bg-gradient-to-br from-orange-400 to-rose-500',
    urgent: 'bg-gradient-to-br from-rose-500 to-red-600',
};

const tagColors = [
    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'bg-pink-500/20 text-pink-400 border-pink-500/30',
    'bg-teal-500/20 text-teal-400 border-teal-500/30',
];

function ChecklistProgressCircle({ task }: { task: Task }) {
    const progress = React.useMemo(() => {
        if (!task.checklist || task.checklist.length === 0) return 0;
        const completedCount = task.checklist.filter(item => item.completed).length;
        return (completedCount / task.checklist.length) * 100;
    }, [task.checklist]);

    if (!task.checklist || task.checklist.length === 0) return null;

    const circumference = 2 * Math.PI * 18; // 2 * pi * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className="relative h-6 w-6 cursor-pointer">
                    <svg className="h-full w-full" viewBox="0 0 40 40">
                        <circle
                            className="text-muted/20"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="transparent"
                            r="18"
                            cx="20"
                            cy="20"
                        />
                        <circle
                            className="text-primary/80"
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="18"
                            cx="20"
                            cy="20"
                            transform="rotate(-90 20 20)"
                        />
                    </svg>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className='font-medium'>Checklist</span>
                        <span className='text-muted-foreground'>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className='h-1.5' />
                    <div className='text-xs text-muted-foreground'>
                        {task.checklist.filter(i => i.completed).length} of {task.checklist.length} tasks completed
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function TaskCard({ task, index, boardMembers, onClick, isDraggable, rotation }: { task: Task; index: number; boardMembers: BoardMember[]; onClick: () => void; isDraggable: boolean; rotation: number; }) {
    
    const getAssignee = (uid: string) => boardMembers.find(m => m.uid === uid);
    const pConfig = task.priority ? priorityConfig[task.priority] : null;

    return (
        <Draggable draggableId={task.id} index={index} isDragDisabled={!isDraggable}>
            {(provided, snapshot) => {
                 const style = {
                    ...provided.draggableProps.style,
                    transform: snapshot.isDragging
                        ? `${provided.draggableProps.style?.transform || ''} rotate(${rotation}deg)`
                        : provided.draggableProps.style?.transform,
                    transition: snapshot.isDragging ? 'transform 0.2s' : 'none',
                };
                return (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={style}
                    >
                        <div
                            onClick={onClick}
                            className={cn(
                                "rounded-xl p-0.5 transition-all shadow-sm hover:shadow-lg cursor-pointer",
                                snapshot.isDragging && "shadow-xl scale-105",
                                pConfig ? pConfig : "bg-border",
                                !isDraggable && 'cursor-not-allowed'
                            )}
                        >
                            <div className="bg-card rounded-[11px] p-3.5 flex flex-col gap-4">
                                <div className="flex justify-between items-start gap-2">
                                    <p className="font-semibold pr-6 flex-1">{task.content}</p>
                                    <div className='flex items-center gap-2'>
                                    <ChecklistProgressCircle task={task} />
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <div className='flex items-center gap-4 text-xs font-medium'>
                                        {task.dueDate && (
                                            <div className='flex items-center gap-1.5'>
                                                <Calendar className='h-3.5 w-3.5' />
                                                <span>{format(asJsDate(task.dueDate), 'd/MM/yyyy')}</span>
                                            </div>
                                        )}
                                        {task.assignees?.[0] && (
                                            <div className='flex items-center gap-1.5'>
                                                <Avatar className="h-5 w-5 border-2 border-card">
                                                    <AvatarImage src={getAssignee(task.assignees[0])?.photoURL} />
                                                    <AvatarFallback>{getAssignee(task.assignees[0])?.displayName?.charAt(0) || '?'}</AvatarFallback>
                                                </Avatar>
                                                <span>{getAssignee(task.assignees[0])?.displayName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {task.tags?.map((tag, index) => (
                                        <Badge key={tag} className={cn('text-xs border font-medium', tagColors[index % tagColors.length])}>#{tag}</Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }}
        </Draggable>
    );
}
