import LandingHeader from '@/components/landing-header';
import LandingHero from '@/components/landing-hero';
import LandingFeatures from '@/components/landing-features';
import LandingFooter from '@/components/landing-footer';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
