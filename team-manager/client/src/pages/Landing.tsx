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
        <div className="min-h-screen relative overflow-hidden bg-background font-sans selection:bg-primary/20">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Navigation */}
            <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                        <Zap className="text-primary-foreground size-5 fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">TeamManager</span>
                </div>
                <div className="hidden md:flex items-center gap-8">
                    <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
                    <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</a>
                    <Button variant="outline" size="sm" onClick={() => (window.location.href = "https://github.com")}>
                        <Github className="mr-2 size-4" /> GitHub
                    </Button>
                </div>
            </nav>

            <main className="relative z-10 container mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-20 items-center">
                {/* Hero Section */}
                <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase">
                        <Rocket className="size-3" />
                        <span>Now in Beta v2.0</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-foreground leading-[1.1]">
                        The Unified <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            Command Center
                        </span>
                        <br />
                        for Engineering Teams
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-[600px] leading-relaxed">
                        A high-fidelity ambient awareness system that brings clarity to your distributed development workflow. One source of truth for every sprint.
                    </p>

                    <div className="grid grid-cols-2 gap-8 pt-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                                <Shield className="size-4 text-primary" />
                                Enterprise Security
                            </div>
                            <p className="text-sm text-muted-foreground">End-to-end encrypted collaboration and audit logs.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                                <Globe className="size-4 text-primary" />
                                Global Infrastructure
                            </div>
                            <p className="text-sm text-muted-foreground">Distributed sync nodes for zero-latency updates.</p>
                        </div>
                    </div>
                </div>

                {/* Auth Section */}
                <div className="flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
                    <Card className="w-full max-w-md liquid-glass border-primary/10 shadow-2xl shadow-primary/5">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold tracking-tight">Sign In</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Access your team's command center
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {serverError && (
                                <Alert variant="destructive" className="animate-in slide-in-from-top-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{serverError}</AlertDescription>
                                </Alert>
                            )}

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="space-y-1">
                                                    <label
                                                        htmlFor="email"
                                                        className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1"
                                                    >
                                                        Email
                                                    </label>
                                                    <FormControl>
                                                        <Input
                                                            id="email"
                                                            type="email"
                                                            placeholder="name@company.com"
                                                            className="bg-background/50 border-primary/10 focus:border-primary/30 h-11"
                                                            {...field}
                                                            disabled={isLoading}
                                                            autoComplete="email"
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage className="text-[10px] uppercase font-bold tracking-widest" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="space-y-1">
                                                    <label
                                                        htmlFor="password"
                                                        className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1"
                                                    >
                                                        Password
                                                    </label>
                                                    <FormControl>
                                                        <Input
                                                            id="password"
                                                            type="password"
                                                            placeholder="••••••••"
                                                            className="bg-background/50 border-primary/10 focus:border-primary/30 h-11"
                                                            {...field}
                                                            disabled={isLoading}
                                                            autoComplete="current-password"
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage className="text-[10px] uppercase font-bold tracking-widest" />
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full h-11 font-bold uppercase tracking-widest text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Spinner className="mr-2 h-4 w-4" />
                                        ) : (
                                            "Initialize Session"
                                        )}
                                    </Button>
                                </form>
                            </Form>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-primary/10"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground font-bold tracking-widest">or</span>
                                </div>
                            </div>

                            <p className="text-center text-xs text-muted-foreground font-medium">
                                New to the system?{" "}
                                <Button
                                    variant="link"
                                    className="p-0 h-auto text-primary font-bold uppercase tracking-widest text-[10px]"
                                    onClick={() => setLocation("/register")}
                                >
                                    Request Access
                                </Button>
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-primary/5 py-12 mt-20">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        &copy; 2026 TeamManager System. All rights reserved.
                    </div>
                    <div className="flex gap-8 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-foreground transition-colors">System Status</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
