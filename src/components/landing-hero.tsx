import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function LandingHero() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Your project management, streamlined.
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Collaborate, manage projects, and reach new productivity peaks. From high rises to the home office, the way your team works is unique—accomplish it all with Streamline.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
          <Image
            src="https://placehold.co/600x400.png"
            width="600"
            height="400"
            alt="Hero"
            data-ai-hint="collaboration abstract"
            className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
          />
        </div>
      </div>
    </section>
  );
}
