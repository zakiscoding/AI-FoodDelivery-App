"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useTheme } from "../context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="relative w-full max-w-sm mx-4 shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{sent ? "Check your inbox" : "Reset password"}</CardTitle>
              {!sent && (
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-4xl">📬</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              If <span className="font-semibold">{email}</span> has an account, you&apos;ll receive a password reset link shortly.
            </p>
            <Button
              onClick={onClose}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full"
              >
                {sending ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  const { login, signup, error, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; name?: boolean }>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email), [email]);
  const passwordValid = useMemo(() => password.length >= 8, [password]);
  const nameValid = useMemo(() => name.trim().length > 0, [name]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!emailValid) {
      setLocalError("Please enter a valid email");
      return;
    }
    if (isSignup && !nameValid) {
      setLocalError("Name is required");
      return;
    }
    if (isSignup && !passwordValid) {
      setLocalError("Must be at least 8 characters");
      return;
    }

    try {
      if (isSignup) {
        await signup(email, password, name, role);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err) {
      // Prefer the thrown message — AuthContext `error` state is not updated yet in this tick
      setLocalError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
      <Button
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
        variant="outline"
        size="icon"
        className="absolute right-4 top-4 z-20"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </Button>
      <div className="relative w-full max-w-md mx-4">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-300/30 to-zinc-400/20 blur-3xl rounded-full opacity-60 dark:from-zinc-700/20 dark:to-zinc-800/20" />
        
        <Card className="relative shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🍽️</span>
              <CardTitle className="text-3xl font-black">QuickBite</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Fast, fresh, delivered
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs
              value={isSignup ? "signup" : "login"}
              onValueChange={(v) => setIsSignup(v === "signup")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                      required
                    />
                    {touched.email && !emailValid && (
                      <p className="mt-1 text-xs font-semibold text-destructive">Please enter a valid email</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                        required
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 h-auto mt-2 text-xs text-muted-foreground"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot password?
                    </Button>
                  </div>

                  {(error || localError) && (
                    <Alert variant="destructive">
                      <AlertDescription>{error || localError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Loading..." : "Login"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="rounded-lg border bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Role
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={role === "customer" ? "default" : "outline"}
                        onClick={() => setRole("customer")}
                      >
                        🛒 Customer
                      </Button>
                      <Button
                        type="button"
                        variant={role === "driver" ? "default" : "outline"}
                        onClick={() => setRole("driver")}
                      >
                        🚗 Driver
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Full name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                      required
                    />
                    {touched.name && !nameValid && (
                      <p className="mt-1 text-xs font-semibold text-destructive">Name is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                      required
                    />
                    {touched.email && !emailValid && (
                      <p className="mt-1 text-xs font-semibold text-destructive">Please enter a valid email</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                        required
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </Button>
                    </div>
                    <div className="mt-2">
                      <Badge variant={passwordValid ? "default" : "outline"}>
                        {passwordValid ? "✓ Strong enough" : "Min 8 characters"}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground">
                      You can switch roles above before creating the account.
                    </p>
                  </div>

                  {(error || localError) && (
                    <Alert variant="destructive">
                      <AlertDescription>{error || localError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Loading..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <Separator />
            <p className="text-xs text-muted-foreground text-center">
              By continuing you agree to our terms and privacy policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
