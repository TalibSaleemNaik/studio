
'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Flag } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Task, BoardMember } from './types';

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityConfig = {
    low: { label: 'Low', color: 'text-gray-500' },
    medium: { label: 'Medium', color: 'text-yellow-500' },
    high: { label: 'High', color: 'text-orange-500' },
    urgent: { label: 'Urgent', color: 'text-red-500' },
};

export function TableView({ tasks, boardMembers, onTaskClick }: { tasks: Task[]; boardMembers: BoardMember[]; onTaskClick: (task: Task) => void; }) {

    const getAssignee = (uid: string) => boardMembers.find(m => m.uid === uid);

    if (tasks.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 border rounded-lg">
                <p className="text-muted-foreground">No tasks match the current filters.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[40%]">Task</TableHead>
                        <TableHead>Assignees</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Tags</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => (
                        <TableRow key={task.id} onClick={() => onTaskClick(task)} className="cursor-pointer">
                            <TableCell className="font-medium">{task.content}</TableCell>
                            <TableCell>
                                <div className="flex -space-x-2">
                                    {task.assignees?.map(uid => {
                                        const member = getAssignee(uid);
                                        return member ? (
                                            <TooltipProvider key={uid}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                         <Avatar className="h-8 w-8 border-2 border-background">
                                                            <AvatarImage src={member.photoURL} />
                                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{member.displayName}</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : null
                                    })}
                                </div>
                            </TableCell>
                            <TableCell>
                                {task.priority && (
                                    <div className="flex items-center gap-2 capitalize">
                                        <Flag className={cn("h-4 w-4", priorityConfig[task.priority].color)} />
                                        <span>{priorityConfig[task.priority].label}</span>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                {task.dueDate && <span>{format(asJsDate(task.dueDate), 'MMM d, yyyy')}</span>}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {task.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
