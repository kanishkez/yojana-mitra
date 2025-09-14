 import { useLocation, useNavigate } from "react-router-dom";
 import { useUserInfo } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CivicButton } from "@/components/ui/civic-button";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink, ArrowLeft, User, CheckCircle } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { useEffect, useState } from 'react';
 import Papa from 'papaparse';

interface UserProfile {
  name?: string;
  age?: string;
  state?: string;
  occupation?: string;
  purpose?: string;
}

interface Scheme {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  eligibility: string[];
  applicationLink: string;
  category: string;
  matchScore: number;
  extras?: { state?: string; tags?: string; level?: string; schemeCategory?: string };
}

 const Recommendations = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo } = useUserInfo();
  const { toast } = useToast();
  
  const userProfile = location.state?.userProfile as UserProfile;

  const [schemes, setSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    const fetchSchemes = async () => {
      try {
        const response = await fetch('/schemes.csv');
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        // Map CSV rows to Scheme type (best-effort)
        const rows = (parsed.data as any[]).map((row, idx) => {
          const benefits = (row.benefits || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
          const eligibility = (row.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
          return {
            id: row.slug || String(idx),
            title: row.scheme_name || row.title || 'Untitled Scheme',
            description: row.details || row.description || '',
            benefits,
            eligibility,
            applicationLink: row.application || row.official_url || '#',
            category: row.schemeCategory || row.level || 'General',
            matchScore: 0,
            extras: {
              state: row.state || row.State || '',
              tags: row.tags || row.Tags || '',
              level: row.level || row.Level || '',
              schemeCategory: row.schemeCategory || row.SchemeCategory || ''
            }
          } as Scheme;
        });

        // Better matching logic
        const profile = (userProfile || userInfo || {}) as any;
        const rawAge = String(profile.age || '').trim();
        const age = Number(rawAge.replace(/[^0-9]/g, '')) || undefined;
        const sector = String(profile.occupation || profile.sector || '').toLowerCase().trim();
        const state = String(profile.state || '').toLowerCase().trim();

        function computeMatchScore(s: Scheme): number {
          const extraText = [s.extras?.state, s.extras?.tags, s.extras?.level, s.extras?.schemeCategory]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const text = [s.eligibility.join(' '), s.description, s.category, extraText].join(' ').toLowerCase();
          let score = 0;

          // State fuzzy contains
          if (state) {
            const stateNorm = state.replace(/\./g, '').trim();
            if (text.includes(stateNorm)) score += 35;
            // Common abbreviations
            const alt = stateNorm.replace(/\s+/g, '');
            if (alt && text.includes(alt)) score += 10;
            // If extras.state present and matches exactly, big boost
            if (s.extras?.state && s.extras.state.toLowerCase().includes(stateNorm)) score += 25;
            // Nationwide schemes
            if (/all india|pan-?india|central|nationwide|entire country/.test(text)) score += 15;
          }

          // Sector/occupation keywords
          if (sector) {
            const sectorMap: Record<string, string[]> = {
              'student': ['student', 'school', 'college', 'pre-matric', 'scholarship', 'education'],
              'farmer': ['farmer', 'agri', 'agriculture', 'kisan', 'crop', 'pm-kisan'],
              'self-employed': ['self employed', 'self-employed', 'entrepreneur', 'startup'],
              'small business owner': ['msme', 'udhyam', 'mudra', 'entrepreneur', 'business', 'sfurti', 'cluster'],
              'salaried employee': ['employee', 'epf', 'esi'],
              'job seeker': ['employment', 'skill', 'training', 'placement'],
              'senior citizen': ['senior citizen', 'old age', 'pension'],
            };
            const keys = Object.entries(sectorMap).find(([k]) => sector.includes(k))?.[1] || [sector];
            if (keys.some(k => text.includes(k))) score += 35;
          }

          // Age parsing: match ranges like 18-60, "above 60", "up to 25"
          if (age) {
            const ageMatchesRange = (() => {
              const ranges = text.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})\s*(?:years|yrs)?/g) || [];
              for (const r of ranges) {
                const m = r.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/);
                if (m) {
                  const a = Number(m[1]);
                  const b = Number(m[2]);
                  if (age >= Math.min(a, b) && age <= Math.max(a, b)) return true;
                }
              }
              if (text.match(/above\s*(\d{1,2})/)) {
                const m = text.match(/above\s*(\d{1,2})/);
                if (m && age > Number(m[1])) return true;
              }
              if (text.match(/upto|up to\s*(\d{1,2})/)) {
                const m = text.match(/(?:upto|up to)\s*(\d{1,2})/);
                if (m && age <= Number(m[1])) return true;
              }
              // Exact mentions like "age 18" or "18 years"
              if (text.includes(` ${age} `) || text.includes(`${age} years`)) return true;
              return false;
            })();
            if (ageMatchesRange) score += 30;
          }

          // Purpose/category light boost
          const purpose = String(profile.purpose || '').toLowerCase();
          if (purpose) {
            if (s.category.toLowerCase().includes(purpose) || s.description.toLowerCase().includes(purpose)) {
              score += 10;
            }
          }

          return score;
        }

        let scored = rows.map((s) => ({ ...s, matchScore: computeMatchScore(s) }));
        let filtered = scored.filter(s => s.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 4);

        // Fallback: if no matches, show top general schemes
        if (filtered.length === 0) {
          filtered = scored
            .sort((a, b) => b.description.length - a.description.length)
            .slice(0, 4);
        }

        setSchemes(filtered);
      } catch (error) {
        console.error('Failed to load schemes.csv', error);
        setSchemes([]);
      }
    };

    if (userInfo || userProfile) {
      fetchSchemes();
    }
  }, [userInfo, userProfile]);

  // No authentication/logout in this flow

  if (!userProfile) {
    navigate("/chatbot");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-civic-blue" />
            <span className="text-xl font-bold text-foreground">SchemeBot</span>
          </div>
          <div />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <CivicButton 
          variant="ghost" 
          onClick={() => navigate("/chatbot")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Start New Search
        </CivicButton>

        {/* User Profile Summary */}
        <Card className="shadow-card border-0 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2 text-civic-blue" />
              Your Profile Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Name</span>
                <p className="font-medium">{userProfile.name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Age</span>
                <p className="font-medium">{userProfile.age}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">State</span>
                <p className="font-medium">{userProfile.state}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Occupation</span>
                <p className="font-medium">{userProfile.occupation}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Interest</span>
                <p className="font-medium">{userProfile.purpose}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Recommended Schemes for You
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Based on your profile, we've found {schemes.length} government schemes that match your needs. 
            Each scheme is ranked by relevance to your situation.
          </p>
        </div>

        {/* Scheme Cards */}
        <div className="grid gap-6">
          {schemes.map((scheme) => (
            <Card key={scheme.id} className="shadow-elevated border-0 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <CardTitle className="text-xl">{scheme.title}</CardTitle>
                      <Badge variant="secondary" className="bg-civic-blue-light text-civic-blue">
                        {scheme.matchScore}% Match
                      </Badge>
                    </div>
                    <Badge variant="outline" className="mb-3">
                      {scheme.category}
                    </Badge>
                    <p className="text-muted-foreground">{scheme.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-civic-blue mb-3 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Key Benefits
                    </h4>
                    <ul className="space-y-2">
                      {scheme.benefits.map((benefit, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start">
                          <span className="w-1.5 h-1.5 bg-civic-blue rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-civic-blue mb-3 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Eligibility Criteria
                    </h4>
                    <ul className="space-y-2">
                      {scheme.eligibility.map((criteria, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start">
                          <span className="w-1.5 h-1.5 bg-civic-blue rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          {criteria}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t">
                  <CivicButton 
                    variant="default" 
                    className="w-full sm:w-auto"
                    onClick={() => window.open(scheme.applicationLink, '_blank')}
                  >
                    Apply Now
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </CivicButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Help */}
        <Card className="shadow-card border-0 mt-8 bg-civic-blue-light">
          <CardContent className="text-center p-8">
            <h3 className="text-xl font-semibold mb-2 text-civic-blue">Need More Help?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Start a new conversation to explore more schemes.
            </p>
            <CivicButton variant="default" onClick={() => navigate("/chatbot")}>
              Start New Search
            </CivicButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Recommendations;