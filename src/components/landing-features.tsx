import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, CheckSquare, Users, BotMessageSquare, CreditCard, Lock, Palette } from "lucide-react";

const features = [
  {
    icon: <LayoutDashboard className="h-8 w-8 text-primary" />,
    title: "Kanban Boards",
    description: "Visualize your workflow with interactive drag-and-drop Kanban boards.",
  },
  {
    icon: <CheckSquare className="h-8 w-8 text-primary" />,
    title: "Task Details",
    description: "Manage tasks with descriptions, due dates, assignees, and comments.",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Team Management",
    description: "Invite team members, assign roles, and collaborate in one workspace.",
  },
  {
    icon: <BotMessageSquare className="h-8 w-8 text-primary" />,
    title: "AI Task Assistant",
    description: "Get smart suggestions for task tags and categories to stay organized.",
  },
  {
    icon: <CreditCard className="h-8 w-8 text-primary" />,
    title: "Stripe Integration",
    description: "Manage subscriptions and billing securely with Stripe integration.",
  },
  {
    icon: <Lock className="h-8 w-8 text-primary" />,
    title: "User Authentication",
    description: "Secure user accounts, login, and profile management with Firebase Auth.",
  },
];

export default function LandingFeatures() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
              Everything you need to get work done
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              A powerful, all-in-one platform to manage your projects, teams, and productivity.
            </p>
          </div>
        </div>
        <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3 mt-12">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-col items-center text-center gap-4">
                {feature.icon}
                <div className="grid gap-1">
                  <CardTitle className="font-headline">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
