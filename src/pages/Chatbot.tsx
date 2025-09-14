 import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CivicButton } from "@/components/ui/civic-button";
import { Badge } from "@/components/ui/badge";
import { Shield, Send, User, Bot, Sparkles, Users as UsersIcon, Briefcase, Target, ChevronRight, ArrowRight } from "lucide-react";
import Papa from 'papaparse';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  suggestions?: string[];
  schemes?: Scheme[]; // optional rich payload to show scheme cards
}

interface UserProfile {
  name?: string;
  age?: string;
  state?: string;
  occupation?: string;
  purpose?: string;
  caste?: string;
  income?: string;
}

interface Scheme {
  id: string;
  title: string;
  description: string;
  applicationLink: string;
  category: string;
  eligibility: string[];
  matchScore: number;
}

const Chatbot = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    type: 'bot',
    content: 'Hello! I\'m your government scheme advisor. Ask me anything about Indian government schemes and I\'ll provide detailed information using Gemini AI.'
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
  // Added: profile, stepper and flow completion flags
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);
  // New: questionnaire form mode (modern UI)
  const [formMode, setFormMode] = useState<boolean>(true);
  const [form, setForm] = useState({ name: "", age: "", occupation: "", sector: "", state: "", income: "", caste: "" });
  const sectors = [
    'Education',
    'Employment & Skill Development',
    'Business & Entrepreneurship',
    'Healthcare',
    'Housing & Urban Development',
    'Women & Child Development',
    'Rural Development',
    'Agriculture & Farming',
    'Senior Citizens',
    'Disability & Welfare',
    'Technology & Innovation',
    'Finance & Banking',
  ];

  // Normalize external URLs for Apply buttons
  const normalizeUrl = (url?: string) => {
    const u = (url || '').trim();
    if (!u) return '#';
    if (u === '#') return '#';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('www.')) return `https://${u}`;
    try {
      // Try treating as domain/path
      const test = new URL(`https://${u}`);
      return test.href;
    } catch {
      return '#';
    }
  };

  // Helper: start recommendations after the form submit, then switch to chat
  const startFromForm = async () => {
    // Save to the same profile state used by the existing logic
    setUserProfile({
      name: form.name,
      age: form.age,
      state: form.state,
      occupation: form.occupation,
      purpose: form.sector,
      caste: form.caste,
      income: form.income,
    });

    // Show welcome + analyzing message
    const welcome: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `Hello ${form.name}! Based on your profile (${form.age} years, ${form.occupation}, interested in ${form.sector}), let me analyze the best matches for you...`,
    };
    setMessages([welcome]);
    // Immediately switch to chat view and show loading spinner
    setFormMode(false);
    setIsLoading(true);

    // Trigger the existing “final step” computation path (CSV-based)
    try {
      const csvText = await fetchCsvText();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const rows = (parsed.data as any[]).map((row, idx) => {
        const eligibility = (row.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
        return {
          id: row.slug || String(idx),
          title: row.scheme_name || row.title || 'Untitled Scheme',
          description: row.details || row.description || '',
          applicationLink: getBestLink(row),
          category: row.schemeCategory || row.level || 'General',
          eligibility,
          matchScore: 0,
          // raw row for engine usage
          __row: row,
        } as Scheme & { __row: any };
      });

      const rawAge = String(form.age || '').trim();
      const age = Number(rawAge.replace(/[^0-9]/g, '')) || undefined;
      const sector = String(form.occupation || '').toLowerCase().trim();
      const state = String(form.state || '').toLowerCase().trim();
      const profile = { ...userProfile, name: form.name, age: form.age, occupation: form.occupation, purpose: form.sector, income: form.income, caste: form.caste } as any;

      // --- Begin: YojanaMitra Scheme Matching Engine (lightweight adaptation) ---
      type RowType = any;
      class SchemeMatchingEngine {
        occupationSynonyms: Record<string, string[]> = {
          'farmer': ['agriculture', 'farming', 'cultivator', 'grower', 'agricultural worker'],
          'student': ['education', 'learning', 'academic', 'scholar'],
          'business': ['entrepreneur', 'trader', 'merchant', 'businessperson', 'self-employed'],
          'teacher': ['educator', 'instructor', 'professor', 'tutor'],
          'doctor': ['medical', 'physician', 'healthcare worker'],
          'engineer': ['technical', 'technology professional'],
          'unemployed': ['job seeker', 'looking for work', 'between jobs'],
          'retired': ['senior citizen', 'pensioner', 'elderly']
        };
        sectorKeywords: Record<string, string[]> = {
          'agriculture': ['farm', 'crop', 'rural', 'agricultural', 'kisan', 'krishi'],
          'education': ['student', 'school', 'college', 'scholarship', 'study', 'vidya'],
          'healthcare': ['medical', 'health', 'hospital', 'treatment', 'ayushman'],
          'employment': ['job', 'skill', 'training', 'employment', 'rojgar'],
          'housing': ['house', 'home', 'housing', 'shelter', 'awas'],
          'women': ['woman', 'women', 'female', 'mahila', 'beti'],
          'senior': ['senior', 'elderly', 'pension', 'old age', 'vridha']
        };
        casteKeywords = ['sc', 'st', 'obc', 'ews', 'vjnt', 'sbc', 'nt', 'bc', 'sebc'];
        schemes: RowType[] = [];
        loadSchemes(data: RowType[]) {
          this.schemes = data.map((row: any, index: number) => ({
            id: index,
            ...row.__row,
            scheme_name: row.title || row.__row?.scheme_name || row.__row?.name,
            description: row.description || row.__row?.details || row.__row?.description,
            sector: row.category || row.__row?.schemeCategory || row.__row?.category,
            eligibility: (row.__row?.eligibility || '').toString(),
            benefits: row.__row?.benefits || '',
            website: getBestLink(row.__row),
            eligibility_normalized: (row.__row?.eligibility || '').toString().toLowerCase(),
            scheme_name_normalized: (row.__row?.scheme_name || row.__row?.name || '').toString().toLowerCase(),
            sector_normalized: (row.__row?.schemeCategory || row.__row?.category || '').toString().toLowerCase(),
            description_normalized: (row.__row?.details || row.__row?.description || '').toString().toLowerCase(),
          }));
        }
        parseEligibilityCriteria(eligibilityText: string) {
          const criteria: any = { minAge: null, maxAge: null, maxSalary: null, occupations: [], sectors: [], genders: [], casteHints: [] };
          const text = (eligibilityText || '').toLowerCase();
          const ageR = [/(\d+)\s*to\s*(\d+)\s*years/, /between\s*(\d+)\s*and\s*(\d+)\s*years/, /above\s*(\d+)/, /upto\s*(\d+)/, /up to\s*(\d+)/];
          for (const r of ageR) { const m = text.match(r); if (m) { if (m[2]) {criteria.minAge=+m[1];criteria.maxAge=+m[2];} else if(r.source.includes('above')) {criteria.minAge=+m[1];} else {criteria.maxAge=+m[1];} break; } }
          const incomeR = /(income|annual)[^\d]*(\d{5,7})/; const mi = text.match(incomeR); if (mi) criteria.maxSalary = +mi[2];
          for (const [occ, syns] of Object.entries(this.occupationSynonyms)) { if (text.includes(occ) || syns.some(s=>text.includes(s))) criteria.occupations.push(occ); }
          for (const [sec, kws] of Object.entries(this.sectorKeywords)) { if (kws.some(k=>text.includes(k))) criteria.sectors.push(sec); }
          if (/(women|female|mahila)/.test(text)) criteria.genders.push('female');
          if (/(men|male)/.test(text)) criteria.genders.push('male');
          criteria.casteHints = this.casteKeywords.filter(c=> new RegExp(`\\b${c}\\b`).test(text));
          return criteria;
        }
        checkEligibilityMatch(user: any, criteria: any) {
          let score = 0; const reasons: string[] = []; const mis: string[] = [];
          const userAge = parseInt(user.age || '0');
          if (criteria.minAge!=null && userAge<criteria.minAge) return {score:0, reasons, mis:[...mis,`Age below ${criteria.minAge}`]};
          if (criteria.maxAge!=null && userAge>criteria.maxAge) return {score:0, reasons, mis:[...mis,`Age above ${criteria.maxAge}`]};
          if (criteria.minAge!=null) {score+=25; reasons.push('Age meets min');}
          if (criteria.maxAge!=null) {score+=25; reasons.push('Age within limit');}
          if (criteria.maxSalary!=null && user.income) {
            const incomeDigits = parseInt((user.income||'').replace(/[^0-9]/g,''));
            if (!isNaN(incomeDigits)) {
              if (incomeDigits>criteria.maxSalary) return {score:0, reasons, mis:[...mis,`Income above limit`]};
              score+=20; reasons.push('Income within limit');
            }
          }
          if (criteria.occupations.length>0) {
            const occ = (user.occupation||'').toLowerCase();
            const match = criteria.occupations.some(o=> occ.includes(o) || (this.occupationSynonyms[o]||[]).some(s=>occ.includes(s)));
            if (match) {score+=20; reasons.push('Occupation matches');}
          }
          if (criteria.sectors.length>0) {
            const sec = (user.purpose||user.sector||'').toLowerCase();
            const match = criteria.sectors.some(s=> sec.includes(s) || (this.sectorKeywords[s]||[]).some(k=>sec.includes(k)));
            if (match) {score+=15; reasons.push('Sector matches');}
          }
          if (criteria.casteHints.length>0 && user.caste) {
            const c = user.caste.toLowerCase();
            if (criteria.casteHints.some((h:string)=> c.includes(h))) {score+=25; reasons.push('Caste eligible');}
            else {score-=10; mis.push('Caste may not match');}
          }
          return {score:Math.max(0,score), reasons, mis};
        }
        calculateRelevance(s: any, user: any) {
          let r=0; const search=(s.scheme_name_normalized+" "+s.description_normalized+" "+s.sector_normalized);
          const words = (user.purpose||'').toLowerCase().split(/\s+/).concat((user.occupation||'').toLowerCase().split(/\s+/));
          words.forEach(w=>{ if(w.length>2 && search.includes(w)) r+=4; });
          if (user.state && search.includes((user.state||'').toLowerCase())) r+=10;
          const age=parseInt(user.age||'0'); if(age<=25 && /youth|student/.test(search)) r+=6; if(age>=60 && /senior|pension/.test(search)) r+=8;
          if (s.website && normalizeUrl(s.website) !== '#') r+=5;
          return r;
        }
        find(user:any, max=10) {
          const out: any[]=[];
          for (const s of this.schemes) {
            const c=this.parseEligibilityCriteria(s.eligibility);
            const em=this.checkEligibilityMatch(user,c);
            const rel=this.calculateRelevance(s,user);
            const total=em.score+rel;
            if (total>0) out.push({scheme:s,totalScore:total,eligibilityScore:em.score,relevanceScore:rel});
          }
          out.sort((a,b)=>b.totalScore-a.totalScore);
          return out.slice(0,max);
        }
      }
      // --- End Engine ---

      const engine = new SchemeMatchingEngine();
      engine.loadSchemes(rows);
      const matches = engine.find(profile, 10);
      const mapped = matches.map((m:any, idx:number)=>({
        id: String(idx),
        title: m.scheme.scheme_name || 'Untitled Scheme',
        description: m.scheme.description || '',
        applicationLink: m.scheme.website || '#',
        category: m.scheme.sector || 'General',
        eligibility: (m.scheme.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s:string)=>s.trim()).filter(Boolean),
        matchScore: m.totalScore,
      })) as Scheme[];

      // Pre-filter by purpose/sector to drop obvious mismatches
      const dropForStudentEducation = (cat: string, text: string) => {
        if (sector.includes('student') && profile.purpose?.toLowerCase().includes('education')) {
          if (/(agri|agriculture|farmer|kisan)/.test(cat) || /(agri|agriculture|farmer|kisan)/.test(text)) return true;
        }
        return false;
      };

      function score(s: Scheme): number {
        const text = [s.eligibility.join(' '), s.description, s.category].join(' ').toLowerCase();
        let sc = 0;

        if (state) {
          const stateNorm = state.replace(/\./g, '').trim();
          if (text.includes(stateNorm)) sc += 40;
          const alt = stateNorm.replace(/\s+/g, '');
          if (alt && text.includes(alt)) sc += 10;
          if (/all india|pan-?india|central|nationwide|entire country/.test(text)) sc += 10;
        }
        const purpose = String(profile.purpose || '').toLowerCase();
        const cat = (s.category || '').toLowerCase();
        const purposeMap: Record<string, string[]> = {
          'education': ['education', 'learning', 'scholar', 'skill', 'student'],
          'agriculture': ['agri', 'agriculture', 'farmer', 'kisan'],
          'business': ['business', 'entrepreneur', 'msme', 'startup'],
          'employment': ['employment', 'job', 'placement', 'skill'],
          'health': ['health', 'medical'],
          'housing': ['housing', 'home', 'pmay'],
          'social': ['social', 'welfare', 'pension'],
          'women': ['women', 'girl', 'mahila']
        };
        const purposeKey = Object.keys(purposeMap).find(k => purpose.toLowerCase().includes(k)) || '';
        if (purposeKey) {
          const keys = purposeMap[purposeKey];
          if (keys.some(k => cat.includes(k) || text.includes(k))) sc += 35;
        }
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
          const secKey = Object.keys(sectorMap).find(k => sector.includes(k));
          const keys = (secKey && sectorMap[secKey]) || [sector];
          if (keys.some(k => text.includes(k))) sc += 30;
          if (dropForStudentEducation(cat, text)) sc -= 50;
        }
        if (age) {
          let matched = false;
          const ranges = text.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/g) || [];
          for (const r of ranges) {
            const m = r.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/);
            if (m) {
              const a = Number(m[1]);
              const b = Number(m[2]);
              if (age >= Math.min(a, b) && age <= Math.max(a, b)) { sc += 25; matched = true; break; }
            }
          }
          const above = text.match(/above\s*(\d{1,2})/);
          const upto = text.match(/(?:upto|up to)\s*(\d{1,2})/);
          if (above && age > Number(above[1])) { sc += 15; matched = true; }
          if (upto && age <= Number(upto[1])) { sc += 15; matched = true; }
          if (/18\+|age\s*18\s*and\s*above/.test(text) && age < 18) sc -= 30;
          if (/senior|60\+/.test(text) && age < 55) sc -= 20;
          if (!matched) sc -= 5;
        }
        return sc;
      }

      // Combine engine matches with heuristic score to finalize top 4
      const MIN_SCORE = 15;
      const candidates = mapped
        .map(r => ({ ...r, matchScore: r.matchScore + score(r) }))
        .filter(r => r.matchScore >= MIN_SCORE && !dropForStudentEducation((r.category || '').toLowerCase(), ([r.eligibility.join(' '), r.description, r.category].join(' ') || '').toLowerCase()))
        .sort((a, b) => {
          const aLink = normalizeUrl(a.applicationLink) !== '#';
          const bLink = normalizeUrl(b.applicationLink) !== '#';
          if (aLink !== bLink) return aLink ? -1 : 1; // prefer items with a valid link
          return b.matchScore - a.matchScore;
        })
        .slice(0, 4);

      // Enrich all candidates (description + single official apply URL) via backend /enrich (Gemini-powered)
      let resolvedCandidates: Scheme[] = candidates;
      try {
        const items = candidates.map(c => ({ scheme_name: c.title }));
        const resp = await fetch(`${API_URL}/enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        if (resp.ok) {
          const data = await resp.json();
          const map: Record<string, { description?: string; apply_url?: string }> = {};
          (data?.enriched || []).forEach((e: any) => {
            if (!e?.scheme_name) return;
            map[String(e.scheme_name).toLowerCase()] = { description: e.description, apply_url: e.apply_url };
          });
          resolvedCandidates = candidates.map((c) => {
            const m = map[String(c.title).toLowerCase()] || {};
            // Prefer Gemini URL if present; else fallback to CSV URL
            const preferred = m.apply_url && String(m.apply_url).trim() ? m.apply_url : c.applicationLink;
            const url = normalizeUrl(preferred);
            return {
              ...c,
              description: m.description || c.description,
              applicationLink: url || c.applicationLink,
            } as Scheme;
          });
        }
      } catch {}

      const resultsMsg: Message = {
        id: (Date.now() + 2).toString(),
        type: 'bot',
        content: `Here are the top ${resolvedCandidates.length} schemes for you. You can apply directly or view more details.`,
        schemes: resolvedCandidates,
      };
      setMessages(prev => [...prev, resultsMsg]);
      setCompleted(true);
    } catch (e) {
      setMessages(prev => [...prev, { id: (Date.now() + 3).toString(), type: 'bot', content: `Sorry, I couldn't load schemes right now. Please try again.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch CSV text preferring backend /csv (SCHEMES_CSV), else fallback to public CSVs
  const fetchCsvText = async (): Promise<string> => {
    // 1) Backend endpoint (serves the file at SCHEMES_CSV)
    try {
      const r0 = await fetch(`${API_URL}/csv`);
      if (r0.ok) return await r0.text();
    } catch {}
    // 2) Public updated_data.csv
    try {
      const r1 = await fetch('/updated_data.csv');
      if (r1.ok) return await r1.text();
    } catch {}
    // 3) Public legacy schemes.csv
    const r2 = await fetch('/schemes.csv');
    if (!r2.ok) throw new Error('csv_not_found');
    return await r2.text();
  };

  // Extract first URL-like token from arbitrary text
  const extractFirstUrl = (text?: string) => {
    const t = (text || '').toString();
    const re = /(https?:\/\/[^\s"')]+)|(www\.[^\s"')]+)/i;
    const m = t.match(re);
    return m ? m[0] : '';
  };

  // Choose best link from CSV row
  const getBestLink = (row: any) => {
    const candidatesKeys = [
      'application', 'official_url', 'application_link', 'apply', 'url', 'link',
      'Application', 'Official_URL', 'Application Link', 'Apply', 'URL', 'Link'
    ];
    for (const k of candidatesKeys) {
      const v = row[k];
      if (v && String(v).trim()) return String(v).trim().replace(/^"|"$/g, '');
    }
    // Try mining from other fields
    const mined = extractFirstUrl(row.details) || extractFirstUrl(row.benefits) || extractFirstUrl(row.documents);
    return mined || '#';
  };

  // Render bot text with basic formatting: bullet lists and paragraphs
  const renderBotText = (text: string) => {
    const lines = text.split(/\r?\n/);
    const blocks: JSX.Element[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length) {
        blocks.push(
          <ul className="list-disc list-inside space-y-1 my-1" key={`ul-${blocks.length}`}>
            {listItems.map((li, i) => (
              <li key={i} className="text-sm text-foreground">{li}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      const bullet = line.match(/^([*\-•])\s+(.*)$/);
      if (bullet) {
        listItems.push(bullet[2]);
        continue;
      }
      // new paragraph boundary
      flushList();
      if (line.length === 0) {
        blocks.push(<div className="h-1" key={`sp-${blocks.length}`} />);
      } else {
        blocks.push(<p className="text-sm leading-relaxed" key={`p-${blocks.length}`}>{line}</p>);
      }
    }
    flushList();
    return <div className="space-y-1">{blocks}</div>;
  };

  const questionFlow = [
    {
      question: "Hello! I'm your government scheme advisor. What's your name?",
      field: 'name',
      suggestions: []
    },
    {
      question: "Nice to meet you! What's your age (in years)?",
      field: 'age',
      suggestions: []
    },
    {
      question: "Which state are you from?",
      field: 'state',
      suggestions: []
    },
    {
      question: "What's your current occupation or education level?",
      field: 'occupation',
      suggestions: ['Student', 'Farmer', 'Small Business Owner', 'Job Seeker', 'Self-Employed', 'Salaried Employee', 'Senior Citizen', 'Other']
    },
    {
      question: "What type of schemes are you most interested in?",
      field: 'purpose',
      suggestions: ['Education & Skill Development', 'Agriculture & Farming', 'Business & Entrepreneurship', 'Employment & Jobs', 'Healthcare', 'Housing', 'Social Security', 'Women Empowerment']
    }
  ];

  useEffect(() => {
    // Try restore history
    try {
      const saved = localStorage.getItem('chat_messages');
      const savedProfile = localStorage.getItem('chat_user_profile');
      const savedStep = localStorage.getItem('chat_current_step');
      const savedCompleted = localStorage.getItem('chat_completed');
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        const welcomeMessage: Message = {
          id: '1',
          type: 'bot',
          content: questionFlow[0].question,
          suggestions: questionFlow[0].suggestions
        };
        setMessages([welcomeMessage]);
      }
      if (savedProfile) setUserProfile(JSON.parse(savedProfile));
      if (savedStep) setCurrentStep(Number(savedStep));
      if (savedCompleted) setCompleted(savedCompleted === 'true');
    } catch (_) {
      const welcomeMessage: Message = {
        id: '1',
        type: 'bot',
        content: questionFlow[0].question,
        suggestions: questionFlow[0].suggestions
      };
      setMessages([welcomeMessage]);
    }
  }, [navigate]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Persist history and profile
  useEffect(() => {
    try { localStorage.setItem('chat_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => {
    try { localStorage.setItem('chat_user_profile', JSON.stringify(userProfile)); } catch {}
  }, [userProfile]);
  useEffect(() => {
    try { localStorage.setItem('chat_current_step', String(currentStep)); } catch {}
  }, [currentStep]);
  useEffect(() => {
    try { localStorage.setItem('chat_completed', String(completed)); } catch {}
  }, [completed]);

  // Clear chat and reset state
  const clearChat = () => {
    // Clear all localStorage data
    localStorage.removeItem('chat_messages');
    localStorage.removeItem('chat_user_profile');
    localStorage.removeItem('chat_current_step');
    localStorage.removeItem('chat_completed');
    
    // Reset all state
    setMessages([{
      id: '1',
      type: 'bot',
      content: questionFlow[0].question,
      suggestions: questionFlow[0].suggestions
    }]);
    setCurrentStep(0);
    setUserProfile({});
    setCompleted(false);
    setInput('');
  };

  // No authentication/logout in this flow

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content
    };

    setMessages(prev => [...prev, userMessage]);

    // After completion, we will use /explain for specific scheme queries; no generic chat call

    // If questionnaire is completed, ALWAYS try Gemini /explain first, then fall back to CSV search
    if (completed) {
      setIsLoading(true);
      try {
        // 1) Try Gemini-powered explain for any scheme question
        try {
          const explainResp = await fetch(`${API_URL}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheme_query: content, question: content })
          });
          if (explainResp.ok) {
            const data = await explainResp.json();
            const answerMsg: Message = { id: (Date.now() + 1).toString(), type: 'bot', content: data.answer };
            setMessages(prev => [...prev, answerMsg]);
            return; // done
          }
        } catch (_) { /* fall back below */ }

        // 2) CSV-based relevance search (fallback)
        const csvText = await fetchCsvText();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const rows = (parsed.data as any[]).map((row, idx) => {
          const eligibility = (row.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
          return {
            id: row.slug || String(idx),
            title: row.scheme_name || row.title || 'Untitled Scheme',
            description: row.details || row.description || '',
            applicationLink: getBestLink(row),
            category: row.schemeCategory || row.level || 'General',
            eligibility,
            matchScore: 0,
          } as Scheme;
        });

        const q = content.toLowerCase();
        const scored = rows.map(r => {
          const hay = [r.title, r.description, r.category, r.eligibility.join(' ')].join(' ').toLowerCase();
          let sc = 0;
          if (hay.includes(q)) sc += 60;
          const tokens = q.split(/\s+/).filter(Boolean);
          sc += tokens.filter(t => hay.includes(t)).length * 5;
          return { ...r, matchScore: sc };
        });

        const top4 = scored.sort((a,b) => b.matchScore - a.matchScore).slice(0,4);
        const resultsMsg: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `Top matches for your query:`,
          schemes: top4,
        };
        setMessages(prev => [...prev, resultsMsg]);
      } catch (_) {
        const errorMessage: Message = { id: Date.now().toString(), type: 'bot', content: "Sorry, I couldn't search schemes right now. Please try again." };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Update user profile for questionnaire
    const currentQuestion = questionFlow[currentStep];
    if (currentQuestion) {
      setUserProfile(prev => ({
        ...prev,
        [currentQuestion.field]: content
      }));
    }

    // Continue with questionnaire
    if (currentStep < questionFlow.length - 1) {
      setTimeout(() => {
        const nextStep = currentStep + 1;
        const nextQuestion = questionFlow[nextStep];
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: nextQuestion.question,
          suggestions: nextQuestion.suggestions
        };
        setMessages(prev => [...prev, botMessage]);
        setCurrentStep(nextStep);
      }, 500);
    } else if (!completed) {
      // Final step reached: compute top 4 schemes and display in chat, mark completed (local CSV only)
      setTimeout(async () => {
        const analyzingMsg: Message = { id: (Date.now() + 1).toString(), type: 'bot', content: `Perfect! Based on your profile, let me analyze the best matches...` };
        setMessages(prev => [...prev, analyzingMsg]);

        try {
          const csvText = await fetchCsvText();
          const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
          const rows = (parsed.data as any[]).map((row, idx) => {
            const eligibility = (row.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
            return {
              id: row.slug || String(idx),
              title: row.scheme_name || row.title || 'Untitled Scheme',
              description: row.details || row.description || '',
              applicationLink: getBestLink(row),
              category: row.schemeCategory || row.level || 'General',
              eligibility,
              matchScore: 0,
            } as Scheme;
          });

          const profile = { ...userProfile, [currentQuestion?.field || '']: content } as any;
          const rawAge = String(profile.age || '').trim();
          const age = Number(rawAge.replace(/[^0-9]/g, '')) || undefined;
          const sector = String(profile.occupation || '').toLowerCase().trim();
          const state = String(profile.state || '').toLowerCase().trim();

          function score(s: Scheme): number {
            const text = [s.eligibility.join(' '), s.description, s.category].join(' ').toLowerCase();
            let sc = 0;

            // Strong state preference
            if (state) {
              const stateNorm = state.replace(/\./g, '').trim();
              if (text.includes(stateNorm)) sc += 40;
              const alt = stateNorm.replace(/\s+/g, '');
              if (alt && text.includes(alt)) sc += 10;
              if (/all india|pan-?india|central|nationwide|entire country/.test(text)) sc += 10;
            }

            // Purpose/category mapping boosts + penalties for mismatches
            const purpose = String(profile.purpose || '').toLowerCase();
            const cat = (s.category || '').toLowerCase();
            const purposeMap: Record<string, string[]> = {
              'education': ['education', 'learning', 'scholar', 'skill', 'student'],
              'agriculture': ['agri', 'agriculture', 'farmer', 'kisan'],
              'business': ['business', 'entrepreneur', 'msme', 'startup'],
              'employment': ['employment', 'job', 'placement', 'skill'],
              'health': ['health', 'medical'],
              'housing': ['housing', 'home', 'pmay'],
              'social': ['social', 'welfare', 'pension'],
              'women': ['women', 'girl', 'mahila']
            };
            const purposeKey = Object.keys(purposeMap).find(k => purpose.includes(k)) || '';
            if (purposeKey) {
              const keys = purposeMap[purposeKey];
              if (keys.some(k => cat.includes(k) || text.includes(k))) sc += 35;
            }

            // Sector boost and negative penalty for unrelated sectors
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
              const secKey = Object.keys(sectorMap).find(k => sector.includes(k));
              const keys = (secKey && sectorMap[secKey]) || [sector];
              if (keys.some(k => text.includes(k))) sc += 30;
              // Penalize agriculture if clearly unrelated to student/education
              if (sector.includes('student') && (cat.includes('agri') || cat.includes('agriculture') || text.includes('farmer'))) sc -= 25;
            }

            // Age constraints
            if (age) {
              let matched = false;
              const ranges = text.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/g) || [];
              for (const r of ranges) {
                const m = r.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/);
                if (m) {
                  const a = Number(m[1]);
                  const b = Number(m[2]);
                  if (age >= Math.min(a, b) && age <= Math.max(a, b)) { sc += 25; matched = true; break; }
                }
              }
              const above = text.match(/above\s*(\d{1,2})/);
              const upto = text.match(/(?:upto|up to)\s*(\d{1,2})/);
              if (above && age > Number(above[1])) { sc += 15; matched = true; }
              if (upto && age <= Number(upto[1])) { sc += 15; matched = true; }
              // Soft penalty if explicit 18+ and user < 18, etc.
              if (/18\+|age\s*18\s*and\s*above/.test(text) && age < 18) sc -= 30;
              if (/senior|60\+/.test(text) && age < 55) sc -= 20;
              if (!matched) sc -= 5;
            }

            // Small boost if tags overlap with purpose or sector keywords (if tags exist in CSV)
            const tags = (rowAt(s)?.toLowerCase?.() || '') as string;
            function rowAt(s2: any) { return (s2 as any)?.tags || ''; }
            const signal = (purpose + ' ' + (sector || '')).toLowerCase();
            if (tags && signal) {
              const hits = signal.split(/\s+/).filter(t => t && tags.includes(t)).length;
              sc += Math.min(hits * 3, 10);
            }
            return sc;
          }

          const top4 = rows.map(r => ({ ...r, matchScore: score(r) }))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 4);

          const resultsMsg: Message = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            content: `Here are the top ${top4.length} schemes for you. You can apply directly or view more details.`,
            schemes: top4,
          };
          setMessages(prev => [...prev, resultsMsg]);
          setCompleted(true);
        } catch (e) {
          const errorMsg: Message = { id: (Date.now() + 3).toString(), type: 'bot', content: `Sorry, I couldn't reach the assistant. Please try again.` };
          setMessages(prev => [...prev, errorMsg]);
        }
      }, 500);
    } else {
      // Already completed questionnaire: ALWAYS try Gemini /explain first; otherwise CSV search
      setTimeout(async () => {
        const thinking: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `Searching schemes related to: "${content}" ...`
        };
        setMessages(prev => [...prev, thinking]);

        try {
          // 1) Try Gemini-powered explain first
          try {
            const explainResp = await fetch(`${API_URL}/explain`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scheme_query: content, question: content })
            });
            if (explainResp.ok) {
              const data = await explainResp.json();
              const answerMsg: Message = { id: (Date.now() + 2).toString(), type: 'bot', content: data.answer };
              setMessages(prev => [...prev, answerMsg]);
              return; // done
            }
          } catch (_) { /* fall back below */ }

          // 2) Otherwise: show top matches from CSV
          const response = await fetch('/schemes.csv');
          const csvText = await response.text();
          const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
          const rows = (parsed.data as any[]).map((row, idx) => {
            const eligibility = (row.eligibility || '').split(/\.|;|\n|•|,\s?/).map((s: string) => s.trim()).filter(Boolean);
            return {
              id: row.slug || String(idx),
              title: row.scheme_name || row.title || 'Untitled Scheme',
              description: row.details || row.description || '',
              applicationLink: getBestLink(row),
              category: row.schemeCategory || row.level || 'General',
              eligibility,
              matchScore: 0,
            } as Scheme;
          });
          const q = content.toLowerCase();
          const scored = rows.map(r => {
            const hay = [r.title, r.description, r.category, r.eligibility.join(' ')].join(' ').toLowerCase();
            let sc = 0;
            if (hay.includes(q)) sc += 60; // direct hit
            const tokens = q.split(/\s+/).filter(Boolean);
            sc += tokens.filter(t => hay.includes(t)).length * 5;
            return { ...r, matchScore: sc };
          });

          const top4 = scored.sort((a,b) => b.matchScore - a.matchScore).slice(0,4);
          const resultsMsg: Message = { id: (Date.now() + 2).toString(), type: 'bot', content: `Top matches for your query:`, schemes: top4 };
          setMessages(prev => [...prev, resultsMsg]);
        } catch (e) {
          const errorMsg: Message = {
            id: (Date.now() + 3).toString(),
            type: 'bot',
            content: `Sorry, I couldn't search schemes right now. Please try again.`,
          };
          setMessages(prev => [...prev, errorMsg]);
        }
      }, 400);
    }

    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await handleSendMessage(input);
    setInput('');
  };

  // Show a modern questionnaire first
  if (formMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
                Yojana Mitra
              </h1>
            </div>
            <p className="text-xl text-gray-700 mb-1">AI-Powered Government Schemes Assistant</p>
            <p className="text-gray-500">Tell us a bit about yourself to personalize recommendations</p>
          </div>

          {/* Card */}
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <div className="grid gap-6">
              {/* Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4" /> Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Age */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <UsersIcon className="w-4 h-4" /> Age
                </label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your age"
                  min={1}
                  max={120}
                />
              </div>

              {/* State */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <UsersIcon className="w-4 h-4" /> State
                </label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Maharashtra, Karnataka"
                />
              </div>

              {/* Occupation */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Briefcase className="w-4 h-4" /> Occupation
                </label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Student, Job Seeker, Business Owner"
                />
              </div>

              {/* Sector */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4" /> Sector of Interest
                </label>
                <select
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select a sector</option>
                  {sectors.map((s) => (
                    <option value={s} key={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Income Level (optional) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <UsersIcon className="w-4 h-4" /> Annual Household Income (optional)
                </label>
                <input
                  type="text"
                  value={form.income}
                  onChange={(e) => setForm({ ...form, income: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Below 2.5L, 2.5L-8L, Above 8L"
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={startFromForm}
                disabled={!form.name || !form.age || !form.occupation || !form.sector}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-orange-500 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                Find My Schemes <ChevronRight className="w-5 h-5" />
              </button>
              <p className="text-gray-500 text-sm mt-3">Takes less than 2 minutes • Free to use</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-civic-blue" />
            <span className="text-xl font-bold text-foreground">Yojana Mitra</span>
          </div>
          <div className="flex items-center gap-2">
            <CivicButton variant="ghost" size="sm" onClick={() => { setMessages([]); setUserProfile({}); setCurrentStep(0); localStorage.removeItem('chat_messages'); localStorage.removeItem('chat_user_profile'); localStorage.removeItem('chat_current_step'); setTimeout(() => { setMessages([{ id: '1', type: 'bot', content: questionFlow[0].question, suggestions: questionFlow[0].suggestions }]); }, 0); }}>Clear chat</CivicButton>
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="container mx-auto px-4 py-6 max-w-4xl flex-1 flex overflow-hidden">
        <Card className="shadow-elevated border-0 flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 p-6 flex flex-col min-h-0">
            <div ref={messagesContainerRef} className="space-y-4 mb-4 flex-1 overflow-y-auto">

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-civic-blue text-white' 
                      : 'bg-civic-blue-light text-civic-blue'
                  }`}>
                    {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                    <div className={`rounded-lg p-3 ${
                      message.type === 'user'
                        ? 'bg-civic-blue text-white'
                        : 'bg-background border shadow-card'
                    }`}>
                      {message.type === 'user' ? (
                        <p className="text-sm">{message.content}</p>
                      ) : (
                        renderBotText(message.content)
                      )}
                    </div>
                    {message.schemes && message.schemes.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {message.schemes.map((s) => (
                          <Card key={s.id} className="border shadow-card">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-foreground leading-snug">{s.title}</h4>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline">{s.category}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.description}</p>
                                  {s.eligibility && s.eligibility.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-foreground mb-1">Eligibility (summary)</p>
                                      <ul className="list-disc list-inside space-y-1">
                                        {s.eligibility.slice(0,3).map((e,i) => (
                                          <li key={i} className="text-xs text-muted-foreground">{e}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        <div className="flex justify-end">
                          <CivicButton variant="ghost" onClick={() => navigate('/recommendations', { state: { userProfile } })}>
                            View more details
                          </CivicButton>
                        </div>
                      </div>
                    )}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="cursor-pointer hover:bg-civic-blue-light transition-colors"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* bottom spacer keeps last message fully visible */}
              <div className="h-1" />
            </div>

            {/* Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your response or click a suggestion above..."
                className="flex-1"
              />
              <CivicButton 
                type="button" 
                variant="outline" 
                onClick={clearChat}
                title="Clear chat and start over"
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </CivicButton>
              <CivicButton 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="relative"
              >
                {isLoading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </CivicButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Chatbot;