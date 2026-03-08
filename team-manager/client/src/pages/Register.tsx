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
import { AlertCircle, Zap, Shield, Globe, UserPlus } from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const registerMutation = trpc.auth.register.useMutation();

  // Redirect if already logged in
  useEffect(() => {
    if (tokenStorage.getAccessToken()) {
      setLocation("/");
    }
  }, [setLocation]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      const result = await registerMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });

      // Store tokens in localStorage
      tokenStorage.setAccessToken(result.accessToken);
      tokenStorage.setRefreshToken(result.refreshToken);

      // Redirect to dashboard
      setLocation("/");
      // Force reload to refresh context and socket
      window.location.reload();
    } catch (error) {
      // Parse error message
      let errorMessage = "Registration failed. Please try again.";

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

  const isLoading = registerMutation.isPending;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background font-sans selection:bg-primary/20 flex flex-col">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Navigation */}
      <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="text-primary-foreground size-5 fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">TeamManager</span>
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex items-center justify-center container mx-auto px-6 py-12">
        <div className="w-full max-w-[1000px] grid lg:grid-cols-2 gap-16 items-center">
          {/* Information Section */}
          <div className="hidden lg:block space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase">
              <UserPlus className="size-3" />
              <span>Join the community</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tighter text-foreground leading-[1.1]">
              Scale Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                Engineering Velocity
              </span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Create your account to unlock the full potential of high-fidelity team coordination and real-time project insights.
            </p>

            <div className="space-y-6 pt-4">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Secure by Design</h3>
                  <p className="text-sm text-muted-foreground">SOC2 compliant infrastructure with end-to-end encryption.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Real-time Syncing</h3>
                  <p className="text-sm text-muted-foreground">Collaborate across timezones with sub-100ms latency.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <Card className="w-full max-w-md liquid-glass border-primary/10 shadow-2xl shadow-primary/5">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Initialize your engineering workspace
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
                                autoComplete="new-password"
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[10px] uppercase font-bold tracking-widest" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <div className="space-y-1">
                            <label
                              htmlFor="confirmPassword"
                              className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1"
                            >
                              Confirm Password
                            </label>
                            <FormControl>
                              <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                className="bg-background/50 border-primary/10 focus:border-primary/30 h-11"
                                {...field}
                                disabled={isLoading}
                                autoComplete="new-password"
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
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Provisioning...
                        </>
                      ) : (
                        "Create Workspace"
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
                  Already have an account?{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-primary font-bold uppercase tracking-widest text-[10px]"
                    onClick={() => setLocation("/")}
                  >
                    Sign In
                  </Button>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-primary/5 py-8 mt-auto">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            &copy; 2026 TeamManager System.
          </div>
          <div className="flex gap-6 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
