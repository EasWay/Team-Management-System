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
import { AlertCircle, Rocket, Shield, Zap, UserPlus, ArrowLeft, Loader2 } from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().min(8, "Confirm Password must be at least 8 characters long"),
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

      if (result.accessToken && result.refreshToken) {
        tokenStorage.setAccessToken(result.accessToken);
        tokenStorage.setRefreshToken(result.refreshToken);
        setLocation("/");
      }
    } catch (error) {
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
    <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B] font-sans selection:bg-primary/20 text-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-12 bg-white rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <Zap className="text-black size-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase italic">TeamMgr</h1>
        </div>

        <Card className="liquid-glass border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-white text-center">Create Account</CardTitle>
            <CardDescription className="text-center text-muted-foreground/60 text-sm">
              Enter your details to create a new account and access the Command Center.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serverError && (
              <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-500 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium uppercase tracking-widest">{serverError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">Email Address</FormLabel>
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
                          autoComplete="new-password"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold text-red-400 uppercase tracking-tight" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">Confirm Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/30 h-11 focus-visible:ring-blue-500/30 transition-all rounded-xl"
                          autoComplete="new-password"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold text-red-400 uppercase tracking-tight" />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 pt-4">
                  <p className="text-[10px] text-muted-foreground/40 text-center uppercase tracking-widest">
                    Password must be at least 8 characters long
                  </p>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-white text-black hover:bg-white/90 h-12 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span role="status" aria-label="loading">Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-white hover:bg-white/5 h-11 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                    onClick={() => setLocation("/login")}
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-3 w-3" />
                    Already have an account? Sign In
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] text-muted-foreground/40 uppercase tracking-widest font-bold">
          &copy; 2026 TeamManager System. Secured by Atsupi Trading.
        </p>
      </div>
    </div>
  );
}
