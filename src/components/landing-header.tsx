import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StreamlineLogo } from "./icons";

export default function LandingHeader() {
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <Link href="#" className="flex items-center justify-center" prefetch={false}>
        <StreamlineLogo className="h-6 w-6 text-primary" />
        <span className="sr-only">Streamline</span>
      </Link>
      <h1 className="ml-2 font-headline text-xl font-semibold">Streamline</h1>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Link href="#" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
          Pricing
        </Link>
        <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign Up</Link>
        </Button>
      </nav>
    </header>
  );
}
