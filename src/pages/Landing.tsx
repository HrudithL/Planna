import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { GraduationCap, BookOpen, Calendar, Download, ArrowRight, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const features = [
    { icon: BookOpen, title: "Browse Courses", desc: "Search and filter hundreds of courses by subject, grade level, and tags." },
    { icon: Calendar, title: "Build Your Plan", desc: "Drag-and-drop course planner with a visual 4-year timeline view." },
    { icon: Download, title: "Export & Share", desc: "Download your degree plan as a CSV file for counselors and parents." },
    { icon: CheckCircle2, title: "Preset Templates", desc: "Start with curated plans for CS, Pre-Med, Engineering, and more." },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-bold text-foreground">Planna</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button asChild><Link to="/dashboard/plans">Dashboard</Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/login">Sign In</Link></Button>
                <Button asChild><Link to="/signup">Get Started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center md:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-primary" /> Plan your future, one course at a time
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-foreground md:text-6xl">
            Your 4-Year High School<br />
            <span className="text-primary">Degree Plan</span>, Simplified
          </h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Planna helps students create, customize, and manage their high school course schedules.
            Build from preset plans or start from scratch — then export and share with counselors.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/signup">
                Start Planning <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-card py-20">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">Everything you need to plan ahead</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border bg-background p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-5 w-5" />
            <span className="font-serif text-sm">Planna</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Planna. Built for students, by students.</p>
        </div>
      </footer>
    </div>
  );
}
