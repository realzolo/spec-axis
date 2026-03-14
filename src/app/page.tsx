import Link from 'next/link';
import { Sparkles, Sliders, Radar, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import NexalyMark from '@/components/common/NexalyMark';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const year = new Date().getFullYear();

  const features = [
    { icon: Sparkles, title: dict.home.feature1Title, description: dict.home.feature1Desc },
    { icon: Sliders, title: dict.home.feature2Title, description: dict.home.feature2Desc },
    { icon: Radar, title: dict.home.feature3Title, description: dict.home.feature3Desc },
  ];

  return (
    <div className="marketing-shell">
      <div className="marketing-bg" aria-hidden="true" />
      <div className="marketing-grid" aria-hidden="true" />
      <div className="marketing-content">
        <header className="mx-auto w-full max-w-6xl px-6 pt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                <NexalyMark className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">Nexaly</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{dict.auth.signIn}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">{dict.home.primaryCta}</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-20">
          <section className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 items-center">
            <div className="space-y-8 max-w-xl">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl">{dict.home.title}</h1>
              <p className="text-base text-muted-foreground sm:text-lg">{dict.home.subtitle}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">
                    {dict.home.primaryCta}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#features">{dict.home.secondaryCta}</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-7 shadow-[0_30px_70px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger opacity-80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning opacity-80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success opacity-80" />
                </div>
                <Badge variant="success" size="sm">92</Badge>
              </div>

              <div className="mt-7 rounded-2xl border border-border bg-muted p-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dict.home.previewQuality}</span>
                  <span>92</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-border">
                  <div className="h-2 w-[82%] rounded-full bg-accent" />
                </div>
                <div className="mt-5 text-xs text-muted-foreground">{dict.home.previewFindings}</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{dict.home.previewFinding1}</span>
                    <Badge variant="danger" size="sm">{dict.reportDetail.severity.high}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{dict.home.previewFinding2}</span>
                    <Badge variant="warning" size="sm">{dict.reportDetail.severity.medium}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{dict.home.previewFinding3}</span>
                    <Badge variant="muted" size="sm">{dict.reportDetail.severity.low}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="mt-24">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold">{dict.home.featuresTitle}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">{dict.home.featuresSubtitle}</p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-2xl border border-border bg-card p-7 shadow-[0_18px_45px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="size-5 text-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{feature.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{feature.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-24">
            <div className="rounded-3xl border border-border bg-card p-10 shadow-[0_30px_70px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">{dict.home.ctaTitle}</h2>
                  <p className="text-sm text-muted-foreground sm:text-base">{dict.home.ctaSubtitle}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/login">{dict.home.ctaPrimary}</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="#features">{dict.home.ctaSecondary}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="mx-auto w-full max-w-6xl px-6 pb-12 text-xs text-muted-foreground">
          © {year} Nexaly. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
