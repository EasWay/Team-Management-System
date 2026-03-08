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
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { tokenStorage } from "@/lib/tokenStorage";
import { AlertCircle, Rocket, Shield, Zap, Globe, Github } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Landing() {
    const [, setLocation] = useLocation();
    const [serverError, setServerError] = useState<string | null>(null);
    const { theme } = useTheme();
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
            setLocation("/");
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
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Mock Features Background */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
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
            <nav className="relative z-50 container mx-auto px-6 py-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="size-9 bg-white rounded-lg flex items-center justify-center">
                        <Zap className="text-black size-6 fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white uppercase italic">TeamMgr</span>
                    <a href="#about" className="ml-10 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors">About</a>
                </div>
                <Button
                    variant="outline"
                    className="bg-black text-white hover:bg-black/90 border-white/20 rounded-full px-8 h-10 text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02]"
                    onClick={() => window.location.href = '/api/oauth/github'}
                >
                    <Github className="mr-2 size-4 fill-white" /> Sign In with GitHub
                </Button>
            </nav>

            <main className="relative z-10 container mx-auto px-6 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
                {/* Hero Section */}
                <div className="max-w-4xl space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-7xl md:text-8xl font-bold tracking-tighter text-white leading-none">
                        The Unified Command <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                            Center for Engineering Teams
                        </span>
                    </h1>

                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                        A high-fidelity ambient awareness system that brings clarity to your distributed development workflow. One source of truth for every sprint.
                    </p>

                    <div className="flex flex-col items-center gap-6 pt-10">
                        <div className="relative group w-full max-w-md">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 font-bold tracking-widest"></div>
                            <div className="relative flex items-center bg-[#0A0A0B]/80 backdrop-blur-xl border border-white/10 rounded-full p-1 pl-6">
                                <input
                                    type="email"
                                    placeholder="Enter your email address"
                                    className="bg-transparent border-none focus:ring-0 text-sm flex-1 placeholder:text-muted-foreground/50"
                                />
                                <Button className="bg-white text-black hover:bg-white/90 rounded-full px-8 h-10 text-[10px] font-bold uppercase tracking-widest">
                                    Join the Waitlist
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="absolute bottom-0 w-full z-10 py-12">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase opacity-40">
                        &copy; 2026 TeamManager System. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
