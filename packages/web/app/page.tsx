import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Zap,
  Shield,
  Palette,
  Globe,
  GitBranch,
  Check,
  ArrowRight,
  Play,
  Star,
  MousePointer2,
  Layers,
  Share2,
} from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();

  const features = [
    {
      icon: <Palette className="h-6 w-6" />,
      title: "Powerful Drawing Tools",
      description: "Create beautiful diagrams, wireframes, and illustrations with our intuitive drawing interface powered by Excalidraw.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Real-time Collaboration",
      description: "Work together with your team in real-time. See changes instantly as team members draw and edit.",
    },
    {
      icon: <Layers className="h-6 w-6" />,
      title: "Organized Workspaces",
      description: "Keep your projects organized with personal and shared workspaces. Manage permissions and access controls.",
    },
    {
      icon: <Share2 className="h-6 w-6" />,
      title: "Easy Sharing",
      description: "Share your drawings and workspaces with team members or clients with simple invitation links.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure & Private",
      description: "Your data is protected with enterprise-grade security. Control who has access to your projects.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Lightning Fast",
      description: "Built with modern technology for blazing fast performance. Auto-save ensures your work is never lost.",
    },
  ];

  const useCases = [
    {
      title: "Design Teams",
      description: "Collaborate on wireframes, mockups, and design concepts",
      icon: <MousePointer2 className="h-5 w-5" />,
    },
    {
      title: "Engineering",
      description: "Create system diagrams, flowcharts, and technical documentation",
      icon: <GitBranch className="h-5 w-5" />,
    },
    {
      title: "Education",
      description: "Interactive learning with visual diagrams and illustrations",
      icon: <Globe className="h-5 w-5" />,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Product Designer",
      company: "TechCorp",
      content: "Collab Draw has transformed how our design team collaborates. The real-time features are incredible!",
      avatar: "SC",
    },
    {
      name: "Mike Johnson",
      role: "Engineering Manager",
      company: "StartupXYZ",
      content: "Perfect for creating system diagrams with the team. The workspace organization is exactly what we needed.",
      avatar: "MJ",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <Palette className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Collab Draw</span>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#use-cases" className="text-muted-foreground hover:text-foreground transition-colors">
                Use Cases
              </a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
                Reviews
              </a>
            </nav>

            <div className="flex items-center space-x-4">
              {!session ? (
                <>
                  <Link href="/api/auth/signin">
                    <Button variant="ghost" className="hover:text-white">Sign In</Button>
                  </Link>
                  <Link href="/api/auth/signin">
                    <Button>Get Started</Button>
                  </Link>
                </>
              ) : (
                <Link href="/app">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  <Star className="h-3 w-3 mr-1" />
                  New: Real-time collaboration
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                  Draw, Design &
                  <span className="text-primary"> Collaborate</span>
                  <br />
                  in Real-time
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  Create beautiful diagrams, wireframes, and illustrations with your team.
                  Powerful drawing tools meet seamless collaboration in one platform.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {!session ? (
                  <Link href="/api/auth/signin">
                    <Button size="lg" className="text-lg px-8">
                      Start Drawing Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/app">
                    <Button size="lg" className="text-lg px-8">
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="lg" className="text-lg px-6">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Free to start
                </div>
                <div className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  No credit card required
                </div>
                <div className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Unlimited projects
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Palette className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Interactive drawing canvas</p>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs px-3 py-1 rounded-full">
                  Live Preview
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-8 -left-8 bg-card border border-border rounded-lg p-3 shadow-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -bottom-4 -right-8 bg-card border border-border rounded-lg p-3 shadow-lg">
                <Zap className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Everything you need to create together
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed for teams that value collaboration and creativity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    {feature.icon}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Built for every team
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From design teams to engineering, Collab Draw adapts to your workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {useCases.map((useCase) => (
              <div key={useCase.title} className="text-center space-y-4 group cursor-pointer">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                  <div className="text-primary">
                    {useCase.icon}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{useCase.title}</h3>
                  <p className="text-muted-foreground">{useCase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Loved by teams worldwide
            </h2>
            <p className="text-xl text-muted-foreground">
              See what our users are saying about Collab Draw
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="border-border/50">
                <CardContent className="p-6 space-y-4">
                  <p className="text-foreground italic">"{testimonial.content}"</p>
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role} at {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Ready to start creating together?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of teams already using Collab Draw to bring their ideas to life
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!session ? (
                <Link href="/api/auth/signin">
                  <Button size="lg" className="text-lg px-8">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Link href="/app">
                  <Button size="lg" className="text-lg px-8">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <Palette className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">Collab Draw</span>
              </div>
              <p className="text-muted-foreground">
                The collaborative drawing platform for modern teams.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Product</h4>
              <div className="space-y-2 text-muted-foreground">
                <button type="button" className="block hover:text-foreground transition-colors text-left">Features</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Pricing</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Security</button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Company</h4>
              <div className="space-y-2 text-muted-foreground">
                <button type="button" className="block hover:text-foreground transition-colors text-left">About</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Blog</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Careers</button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Support</h4>
              <div className="space-y-2 text-muted-foreground">
                <button type="button" className="block hover:text-foreground transition-colors text-left">Help Center</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Contact</button>
                <button type="button" className="block hover:text-foreground transition-colors text-left">Status</button>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 Collab Draw. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
