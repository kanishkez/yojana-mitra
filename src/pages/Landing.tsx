import { CivicButton } from "@/components/ui/civic-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, FileText, Star } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-civic-blue" />
            <span className="text-xl font-bold text-foreground">Yojana Mitra</span>
          </div>
          <Link to="/auth">
            <CivicButton variant="outline">Sign In</CivicButton>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            🇮🇳 Government Scheme Advisor
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Find the Right Government Schemes for You
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get personalized recommendations for government schemes and benefits based on your profile. 
            Simple, fast, and reliable guidance in multiple languages.
          </p>
          <Link to="/auth">
            <CivicButton variant="hero" size="lg">
              Get Started
            </CivicButton>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our intelligent system guides you through a simple conversation to understand your needs and find matching government schemes.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="p-6 shadow-card border-0 bg-background">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-civic-blue-light rounded-lg mb-4">
                <Users className="h-6 w-6 text-civic-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Share Your Profile</h3>
              <p className="text-muted-foreground">
                Tell us about yourself through our guided conversation - age, location, occupation, and goals.
              </p>
            </div>
          </Card>

          <Card className="p-6 shadow-card border-0 bg-background">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-civic-blue-light rounded-lg mb-4">
                <Star className="h-6 w-6 text-civic-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Recommendations</h3>
              <p className="text-muted-foreground">
                Our AI analyzes thousands of schemes to find the ones you're eligible for and would benefit from.
              </p>
            </div>
          </Card>

          <Card className="p-6 shadow-card border-0 bg-background">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-civic-blue-light rounded-lg mb-4">
                <FileText className="h-6 w-6 text-civic-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Apply with Confidence</h3>
              <p className="text-muted-foreground">
                Get detailed information about benefits, eligibility criteria, and direct links to application portals.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Shield className="h-5 w-5 text-civic-blue" />
            <span>Yojana Mitra - Empowering Citizens with Information</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;