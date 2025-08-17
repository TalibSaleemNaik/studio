import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const boards = [
  {
    title: "Q3 Marketing Campaign",
    description: "Launch plan for the new campaign.",
    members: ["+2"],
  },
  {
    title: "Website Redesign",
    description: "Complete overhaul of the company website.",
    members: ["+4"],
  },
  {
    title: "Mobile App Development",
    description: "Build the new iOS and Android apps.",
    members: ["+6"],
  },
  {
    title: "New Feature Rollout",
    description: "Plan and execute the release of feature X.",
    members: ["+3"],
  },
];


export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
          <p className="text-muted-foreground">An overview of your projects and workspaces.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Board
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-headline font-semibold mb-4">My Boards</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <Card key={board.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-headline">{board.title}</CardTitle>
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
                <CardDescription>{board.description}</CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-between items-center">
                <div className="flex -space-x-2 overflow-hidden">
                  <Avatar>
                    <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026024d" />
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                    <AvatarFallback>B</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>{board.members[0]}</AvatarFallback>
                  </Avatar>
                </div>
                <Button variant="secondary" size="sm">View Board</Button>
              </CardFooter>
            </Card>
          ))}
           <Card className="flex items-center justify-center border-dashed hover:border-primary hover:text-primary transition-colors">
              <CardContent className="p-6 text-center">
                <Button variant="ghost" className="flex flex-col h-auto gap-2">
                  <PlusCircle className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">New Board</span>
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
