import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { tokenStorage } from "@/lib/tokenStorage";
import { AlertCircle, Zap, Globe, Github, Loader2, LogIn, UserPlus } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Landing() {
    const [, setLocation] = useLocation();
    const [serverError, setServerError] = useState<string | null>(null);
    const loginMutation = trpc.auth.login.useMutation();

    // Redirect if already logged in
    useEffect(() => {
        if (tokenStorage.getAccessToken()) {
            setLocation("/");
        }
    }, [setLocation]);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: LoginFormValues) {
        setServerError(null);
        try {
            const result = await loginMutation.mutateAsync({
                email: values.email,
                password: values.password,
            });

            tokenStorage.setAccessToken(result.accessToken);
            tokenStorage.setRefreshToken(result.refreshToken);
            const inviteToken = localStorage.getItem('pending_invite_token');
            if (inviteToken) {
                setLocation(`/accept-invite?token=${inviteToken}`);
            } else {
                setLocation("/");
            }
            // Force reload to refresh context and socket
            window.location.reload();
        } catch (error) {
            let errorMessage = "Login failed. Please try again.";
            if (error instanceof Error) {
                try {
                    const parsed = JSON.parse(error.message);
                    errorMessage = parsed.error || errorMessage;
                } catch {
                    errorMessage = error.message;
                }
            }
            setServerError(errorMessage);
        }
    }

    const isLoading = loginMutation.isPending;

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B] font-sans selection:bg-primary/20 text-white">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] sm:w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] sm:w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Mock Features Background — decorative, hidden below lg since absolute
                positioning collides with the stacked layout on small screens */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none opacity-40">
                {/* Sprint Velocity Card */}
                <div className="absolute top-[20%] left-[5%] w-72 liquid-glass p-6 rounded-2xl border border-white/5 animate-float" style={{ animationDelay: '0.5s' }}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sprint Velocity</span>
                    </div>
                    <div className="space-y-3">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Current team velocity is at 84%. Consider adjusting scope for the upcoming milestone.</p>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full w-[84%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        </div>
                        <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter text-muted-foreground">
                            <span>View Insights</span>
                            <span className="text-blue-400">High Performance</span>
                        </div>
                    </div>
                </div>

                {/* Storage Status Card */}
                <div className="absolute top-[15%] right-[10%] w-64 liquid-glass p-6 rounded-2xl border border-white/5 animate-float" style={{ animationDelay: '1.2s' }}>
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Storage Status</span>
                        <div className="size-1.5 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="relative flex flex-col items-center justify-center">
                        <svg className="size-32 transform -rotate-90">
                            <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                            <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={351.85} strokeDashoffset={351.85 * (1 - 0.75)} className="text-blue-500" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-2xl font-bold">75%</span>
                            <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Capacity</span>
                        </div>
                    </div>
                </div>

                {/* Team Snapshot */}
                <div className="absolute bottom-[20%] left-[15%] w-80 liquid-glass p-6 rounded-2xl border border-white/5 animate-float" style={{ animationDelay: '0.8s' }}>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500"></div>
                        <div>
                            <h4 className="text-xs font-bold">Alex Rivera</h4>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Lead Engineer • @arivera</p>
                        </div>
                        <span className="ml-auto text-[8px] font-bold uppercase tracking-widest text-green-400">Active</span>
                    </div>
                    <div className="flex -space-x-3 mb-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="size-8 rounded-full border-2 border-[#0A0A0B] bg-white/10"></div>
                        ))}
                        <div className="size-8 rounded-full border-2 border-[#0A0A0B] bg-white/5 flex items-center justify-center text-[8px] font-bold">+12</div>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full w-[45%] bg-blue-500"></div>
                    </div>
                </div>

                {/* Roadmap Card */}
                <div className="absolute bottom-[25%] right-[15%] w-56 liquid-glass p-6 rounded-2xl border border-white/5 animate-float" style={{ animationDelay: '1.5s' }}>
                    <Globe className="size-5 text-muted-foreground mb-4" />
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold">Q4 Roadmap</h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">12.4 MB • Updated 2h ago</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="relative z-50 container mx-auto px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="size-8 sm:size-9 bg-white rounded-lg flex items-center justify-center shrink-0">
                        <Zap className="text-black size-5 sm:size-6 fill-current" />
                    </div>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase italic">TeamMgr</span>
                    <a href="#about" className="hidden sm:inline ml-10 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors">About</a>
                </div>
                <Button
                    variant="outline"
                    className="bg-black text-white hover:bg-black/90 border-white/20 rounded-full px-4 sm:px-8 h-9 sm:h-10 text-[11px] sm:text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] shrink-0"
                    onClick={() => window.location.href = '/api/oauth/github'}
                >
                    <Github className="mr-1.5 sm:mr-2 size-4 fill-white" /> <span className="hidden xs:inline sm:inline">Sign In with </span>GitHub
                </Button>
            </nav>

            <main className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 min-h-[calc(100vh-160px)] py-8">
                {/* Hero Section */}
                <div className="max-w-2xl space-y-6 sm:space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-white leading-none">
                        The Unified Command{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                            Center for Engineering Teams
                        </span>
                    </h1>

                    <p className="text-base sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed font-light">
                        A high-fidelity ambient awareness system that brings clarity to your distributed development workflow. One source of truth for every sprint.
                    </p>
                </div>

                {/* Login Card */}
                <div className="w-full max-w-md shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <Card className="liquid-glass border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold tracking-tight text-white text-center">Sign In</CardTitle>
                            <CardDescription className="text-center text-muted-foreground/60 text-sm">
                                Access your Command Center.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {serverError && (
                                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-xs font-medium uppercase tracking-widest">{serverError}</AlertDescription>
                                </Alert>
                            )}

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="name@example.com"
                                                        {...field}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/30 h-11 focus-visible:ring-blue-500/30 transition-all rounded-xl"
                                                        type="email"
                                                        autoComplete="email"
                                                        disabled={isLoading}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px] font-bold text-red-400 uppercase tracking-tight" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">Password</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        {...field}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/30 h-11 focus-visible:ring-blue-500/30 transition-all rounded-xl"
                                                        autoComplete="current-password"
                                                        disabled={isLoading}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px] font-bold text-red-400 uppercase tracking-tight" />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full bg-white text-black hover:bg-white/90 h-12 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                <span role="status" aria-label="loading">Signing In...</span>
                                            </>
                                        ) : (
                                            <>
                                                <LogIn className="mr-2 h-4 w-4" />
                                                Initialize Session
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </Form>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                    <span className="bg-[#0A0A0B] px-3 text-muted-foreground/40">Or</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full bg-black text-white hover:bg-black/90 border-white/10 h-11 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all"
                                onClick={() => window.location.href = '/api/oauth/github'}
                            >
                                <Github className="mr-2 h-4 w-4 fill-white" />
                                Sign In with GitHub
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-muted-foreground hover:text-white hover:bg-white/5 h-10 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                                onClick={() => setLocation("/register")}
                            >
                                <UserPlus className="mr-2 h-3 w-3" />
                                Don't have an account? Sign Up
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full py-8 sm:py-12">
                <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-4 sm:gap-8">
                    <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase opacity-40 text-center">
                        &copy; 2026 TeamManager System. All rights reserved.
                    </div>
                    <div className="flex gap-6">
                        <a href="/privacy" className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">
                            Privacy Policy
                        </a>
                        <a href="/terms" className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">
                            Terms of Service
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
