"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Board {
  id: string;
  name: string;
  description: string;
}

function CreateBoardDialog({ workspaceId, createBoardAction, children }: { workspaceId: string, createBoardAction: (formData: FormData) => void, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const formRef = React.useRef<HTMLFormElement>(null);

    const handleAction = async (formData: FormData) => {
        try {
            await createBoardAction(formData);
            toast({ title: "Board created successfully!" });
            setIsOpen(false);
            formRef.current?.reset();
             // The page will re-render automatically due to server-side changes
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to create board' });
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form ref={formRef} action={handleAction}>
                    <DialogHeader>
                        <DialogTitle>Create New Board</DialogTitle>
                        <DialogDescription>
                            Give your new board a title and description.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input id="title" name="title" placeholder="e.g. Q4 Roadmap" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Textarea id="description" name="description" placeholder="Describe the board's purpose." className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">
                            Create Board
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function DashboardClient({ boards, workspaceId, createBoardAction }: { boards: Board[], workspaceId: string, createBoardAction: (formData: FormData) => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {boards.map((board) => (
        <Card key={board.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
            <div className="flex items-start justify-between">
            <CardTitle className="font-headline">{board.name}</CardTitle>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>Archive</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </div>
            <CardDescription>{board.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-between items-center">
            <div className="flex -space-x-2 overflow-hidden">
                <Avatar>
                    <AvatarFallback>+?</AvatarFallback>
                </Avatar>
            </div>
            <Button asChild variant="secondary" size="sm">
                <Link href={`/board/${board.id}`}>View Board</Link>
            </Button>
        </CardFooter>
        </Card>
    ))}
    <CreateBoardDialog workspaceId={workspaceId} createBoardAction={createBoardAction}>
        <Card className="flex items-center justify-center border-dashed hover:border-primary hover:text-primary transition-colors cursor-pointer">
            <CardContent className="p-6 text-center">
                <div className="flex flex-col h-auto gap-2 items-center">
                <PlusCircle className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">New Board</span>
                </div>
            </CardContent>
        </Card>
    </CreateBoardDialog>
    </div>
  )
}
