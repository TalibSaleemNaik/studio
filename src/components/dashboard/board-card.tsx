
'use client';

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreVertical, Lock, User, Move, Trash2 } from "lucide-react";
import type { Board, TeamRoom, UserProfile } from "@/components/board/types";

interface BoardCardProps {
    board: Board;
    workpanelId: string;
    teamRooms: TeamRoom[];
    boardMembers: UserProfile[];
    openDeleteDialog: (board: Board) => void;
    handleMoveBoard: (boardId: string, newTeamRoomId: string) => void;
    canDelete: boolean;
}

export function BoardCard({ board, workpanelId, teamRooms, boardMembers, openDeleteDialog, handleMoveBoard, canDelete }: BoardCardProps) {
    const owner = boardMembers.find(m => m.uid === board.ownerId);

    return (
        <Card className="hover:shadow-md transition-shadow flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                         {board.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" />}
                         <CardTitle className="font-headline">{board.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                             <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Move className="mr-2 h-4 w-4" />
                                    <span>Move to</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                     {teamRooms.filter(f => f.id !== board.teamRoomId).map(teamRoom => (
                                         <DropdownMenuItem key={teamRoom.id} onSelect={() => handleMoveBoard(board.id, teamRoom.id)}>
                                             {teamRoom.name}
                                         </DropdownMenuItem>
                                     ))}
                                     { board.teamRoomId && 
                                        <DropdownMenuItem onSelect={() => handleMoveBoard(board.id, '')}>
                                            Uncategorized
                                        </DropdownMenuItem>
                                     }
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {canDelete && (
                                <DropdownMenuItem onSelect={() => openDeleteDialog(board)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2 h-10">{board.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center mt-auto">
                <TooltipProvider>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                            {boardMembers.slice(0, 3).map(member => (
                                <Tooltip key={member.uid}>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarImage src={member.photoURL} />
                                            <AvatarFallback>{member.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>{member.displayName}</TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                        {owner && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{owner.displayName}</span>
                            </div>
                        )}
                    </div>
                </TooltipProvider>
                <Button asChild variant="secondary" size="sm">
                    <Link href={`/board/${board.id}?workpanelId=${workpanelId}`}>View Board</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
