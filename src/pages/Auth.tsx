 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { CivicButton } from "@/components/ui/civic-button";
 import { Shield } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/lib/supabase";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!supabase) throw new Error("Supabase client not initialized");

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Signed In", description: "Redirecting to chatbot..." });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({ title: "Account Created", description: "Redirecting to chatbot..." });
      }
      navigate("/chatbot");
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Illustration */}
      <div className="hidden lg:flex bg-gradient-civic items-center justify-center p-8">
        <div className="text-center text-white max-w-md">
          <Shield className="h-24 w-24 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Secure Access to Government Services</h2>
          <p className="text-lg opacity-90">
            Your trusted platform for discovering and accessing government schemes and benefits designed for you.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <Card className="shadow-elevated border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                {isLogin ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? "Sign in to access your personalized scheme recommendations" 
                  : "Join thousands of citizens finding the right government schemes"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <CivicButton type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
                </CivicButton>
              </form>

              {/* Google sign-in removed as requested */}

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-civic-blue hover:underline"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;