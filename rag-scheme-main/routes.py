from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from pathlib import Path
import csv
import pandas as pd
import difflib

from utils.embeddings import EmbeddingService
from utils.faiss_handler import FAISSHandler
from utils.csv_processor import CSVProcessor

router = APIRouter()

# Initialize services
embedding_service = EmbeddingService()
faiss_handler = FAISSHandler()
csv_processor = CSVProcessor()

# --- Gemini + CSV Chatbot Utilities ---
_CSV_CACHE: Dict[str, pd.DataFrame] = {}

def _load_schemes_csv(csv_path: Optional[str] = None) -> pd.DataFrame:
    """Load schemes CSV into a cached pandas DataFrame."""
    resolved = csv_path or os.getenv("SCHEMES_CSV") or str(Path(__file__).resolve().parents[1] / "schemes.csv")
    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"schemes.csv not found at {resolved}")
    if resolved in _CSV_CACHE:
        return _CSV_CACHE[resolved]
    try:
        df = pd.read_csv(resolved)
        _CSV_CACHE[resolved] = df
        return df
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read CSV: {e}")

def _filter_schemes(
    df: pd.DataFrame,
    name_query: Optional[str] = None,
    state: Optional[str] = None,
    sector: Optional[str] = None,
    income_level: Optional[str] = None,
    tags: Optional[List[str]] = None,
    limit: int = 10,
) -> pd.DataFrame:
    """Heuristic filtering of schemes based on user attributes and optional name text query."""
    filtered = df.copy()
    def norm(s):
        return str(s).strip().lower() if pd.notna(s) else ""

    if state:
        s = norm(state)
        filtered = filtered[filtered.get("state").apply(lambda x: s in norm(x) if "state" in filtered.columns else True)]
    if sector and "schemeCategory" in filtered.columns:
        sec = norm(sector)
        filtered = filtered[filtered["schemeCategory"].apply(lambda x: sec in norm(x))]
    if income_level and "eligibility" in filtered.columns:
        inc = norm(income_level)
        filtered = filtered[filtered["eligibility"].apply(lambda x: inc in norm(x))]
    if tags and "tags" in filtered.columns:
        tagset = {norm(t) for t in tags}
        filtered = filtered[filtered["tags"].apply(lambda x: any(t in norm(x) for t in tagset))]
    if name_query:
        q = norm(name_query)
        mask = (
            filtered.get("scheme_name", pd.Series([], dtype=str)).apply(lambda x: q in norm(x)) |
            filtered.get("slug", pd.Series([], dtype=str)).apply(lambda x: q in norm(x)) |
            filtered.get("details", pd.Series([], dtype=str)).apply(lambda x: q in norm(x))
        )
        filtered = filtered[mask]

    # If nothing left, fall back to original df to allow Gemini to ask clarifying questions
    if filtered.empty:
        filtered = df.head(limit)
    else:
        filtered = filtered.head(limit)
    return filtered

def _format_schemes_for_context(rows: pd.DataFrame) -> str:
    parts: List[str] = []
    for _, r in rows.iterrows():
        parts.append("\n".join([
            f"Scheme Name: {r.get('scheme_name', '')}",
            f"Details: {r.get('details', '')}",
            f"Benefits: {r.get('benefits', '')}",
            f"Eligibility: {r.get('eligibility', '')}",
            f"State: {r.get('state', '')}",
            f"Category: {r.get('schemeCategory', '')}",
            f"Level: {r.get('level', '')}",
            f"Tags: {r.get('tags', '')}",
            f"Application: {r.get('application', '') or r.get('official_url', '')}",
        ]))
    return "\n\n---\n\n".join(parts)

class IngestRequest(BaseModel):
    csv_path: str
    text_column: str = "text"  # For scheme data, this will be ignored as we use multiple columns

class IngestResponse(BaseModel):
    message: str
    chunks_processed: int
    index_size: int

class QueryRequest(BaseModel):
    query: str
    k: int = 5

class QueryResponse(BaseModel):
    results: List[dict]
    query: str
    k: int

class ExplainRequest(BaseModel):
    scheme_query: str
    question: Optional[str] = None
    csv_path: Optional[str] = None  # override default if provided

class ExplainResponse(BaseModel):
    scheme_name: str
    answer: str
    application_link: Optional[str] = None

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    # Optional structured signals from UI
    name: Optional[str] = None
    age: Optional[int] = None
    sector: Optional[str] = None
    income_level: Optional[str] = None
    state: Optional[str] = None
    tags: Optional[List[str]] = None
    csv_path: Optional[str] = None
    limit: int = 8

class ChatResponse(BaseModel):
    reply: str
    recommended: List[Dict[str, Any]]

class ResolveUrlRequest(BaseModel):
    scheme_query: str
    csv_path: Optional[str] = None

class ResolveUrlResponse(BaseModel):
    scheme_name: str
    url: Optional[str]

class EnrichItem(BaseModel):
    scheme_name: str
    context: Optional[str] = None

class EnrichRequest(BaseModel):
    items: List[EnrichItem]
    csv_path: Optional[str] = None

class EnrichedScheme(BaseModel):
    scheme_name: str
    description: Optional[str] = None
    apply_url: Optional[str] = None

class EnrichResponse(BaseModel):
    enriched: List[EnrichedScheme]

@router.post("/ingest", response_model=IngestResponse)
async def ingest_csv(request: IngestRequest):
    """Ingest CSV file and create/update FAISS index."""
    try:
        # Validate CSV file
        if not os.path.exists(request.csv_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CSV file not found: {request.csv_path}"
            )
        
        if not csv_processor.validate_csv(request.csv_path, request.text_column):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV file validation failed. For scheme data, ensure columns 'scheme_name' and 'details' exist. For other data, ensure column '{request.text_column}' exists."
            )
        
        # Process CSV
        chunks, sources = csv_processor.process_csv(request.csv_path, request.text_column)
        
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid text data found in CSV"
            )
        
        # Generate embeddings
        embeddings = embedding_service.embed_texts(chunks)
        
        # Create or update FAISS index
        if faiss_handler.index is None:
            faiss_handler.create_index(len(embeddings[0]))
        
        # Add embeddings to index
        faiss_handler.add_embeddings(embeddings, chunks)
        
        # Save index
        faiss_handler.save_index()
        
        return IngestResponse(
            message=f"Successfully ingested {len(chunks)} chunks from {request.csv_path}",
            chunks_processed=len(chunks),
            index_size=faiss_handler.get_index_size()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during ingestion: {str(e)}"
        )

@router.post("/explain", response_model=ExplainResponse)
async def explain_scheme(request: ExplainRequest):
    """Explain a specific scheme using Gemini if available, grounded by CSV context."""
    try:
        # Locate CSV
        csv_path = request.csv_path or os.getenv("SCHEMES_CSV") or str(Path(__file__).resolve().parents[1] / "schemes.csv")
        if not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail=f"schemes.csv not found at {csv_path}")

        # Load CSV and find best matching row (robust to typos and partial names)
        target_row = None
        best_score = -1.0
        # Normalize query: drop the word 'scheme' and extra spaces
        raw_q = (request.scheme_query or "").strip()
        q = raw_q.lower().replace(' scheme', '').strip()
        q_tokens = set([t for t in q.split() if t])
        with open(csv_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = (row.get('scheme_name') or '').strip()
                slug = (row.get('slug') or '').strip()
                details = (row.get('details') or '').strip()

                name_l = name.lower()
                slug_l = slug.lower()
                details_l = details.lower()

                # Base signals
                substr = 1.0 if q and (q in name_l or q in slug_l) else 0.0
                # Fuzzy similarity on title
                fuzzy = difflib.SequenceMatcher(None, q, name_l).ratio()
                # Token overlap with title and details
                title_tokens = set(name_l.split())
                details_tokens = set(details_l.split())
                overlap = 0.0
                if q_tokens:
                    overlap = (len(q_tokens & title_tokens) * 1.0) + (len(q_tokens & details_tokens) * 0.2)

                # Compose score: prioritize title matches
                score = substr * 1.2 + fuzzy * 1.0 + overlap * 0.5

                if score > best_score:
                    best_score = score
                    target_row = row

        if not target_row:
            raise HTTPException(status_code=404, detail="No matching scheme found in CSV")

        # Build context
        context_parts = []
        def add(label, key):
            val = target_row.get(key)
            if val:
                context_parts.append(f"{label}: {val}")
        add("Scheme Name", 'scheme_name')
        add("Details", 'details')
        add("Benefits", 'benefits')
        add("Eligibility", 'eligibility')
        add("Application", 'application')
        add("Documents", 'documents')
        add("Level", 'level')
        add("Category", 'schemeCategory')
        add("Tags", 'tags')
        add("State", 'state')
        context = "\n".join(context_parts)

        app_link = target_row.get('application') or target_row.get('official_url')
        scheme_name = target_row.get('scheme_name') or 'Unknown Scheme'

        # Try Gemini
        api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = (
                    "You are Yojana Mitra, an assistant for Indian government schemes.\n"
                    "Answer the user's question ONLY using the provided scheme context.\n"
                    "Be concise, use bullet points, and include key eligibility and benefits.\n"
                    "If application link is provided, include a clear call to action.\n\n"
                    f"Question: {request.question or 'Explain this scheme'}\n\n"
                    f"Context:\n{context}"
                )
                resp = model.generate_content(prompt)
                text = resp.text if hasattr(resp, 'text') else str(resp)
                return ExplainResponse(scheme_name=scheme_name, answer=text, application_link=app_link)
            except Exception as e:
                # Fallback below
                pass

        # Fallback extractive summary
        answer = [f"{scheme_name}", "", target_row.get('details') or ""]
        if target_row.get('benefits'):
            answer += ["", "Benefits:", target_row['benefits']]
        if target_row.get('eligibility'):
            answer += ["", "Eligibility:", target_row['eligibility']]
        if app_link:
            answer += ["", f"Apply: {app_link}"]
        return ExplainResponse(scheme_name=scheme_name, answer="\n".join(answer), application_link=app_link)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explain failed: {str(e)}")

@router.post("/resolve_url", response_model=ResolveUrlResponse)
async def resolve_url(request: ResolveUrlRequest):
    """Return the best official/application URL for a scheme using CSV and Gemini as fallback."""
    # Locate CSV
    csv_path = request.csv_path or os.getenv("SCHEMES_CSV") or str(Path(__file__).resolve().parents[1] / "schemes.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"schemes.csv not found at {csv_path}")

    q = (request.scheme_query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="scheme_query required")

    # Try exact/heuristic match in CSV
    best = None
    best_score = -1
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get('scheme_name') or '').strip()
            score = difflib.SequenceMatcher(None, q.lower(), name.lower()).ratio()
            if q.lower() in name.lower():
                score += 0.5
            if score > best_score:
                best_score = score
                best = row

    def pick_url(r: Dict[str, Any]) -> Optional[str]:
        for k in [
            'application', 'official_url', 'application_link', 'apply', 'url', 'link',
            'Application', 'Official_URL', 'Application Link', 'Apply', 'URL', 'Link']:
            v = r.get(k)
            if v and str(v).strip():
                return str(v).strip()
        return None

    def normalize(u: Optional[str]) -> Optional[str]:
        if not u:
            return None
        u = u.strip().strip('"')
        if not u:
            return None
        if u.startswith('http://') or u.startswith('https://'):
            return u
        if u.startswith('www.'):
            return f"https://{u}"
        # If the field is long text (instructions), ignore
        if ' ' in u:
            return None
        return f"https://{u}"

    if best:
        url = normalize(pick_url(best))
        if url:
            return ResolveUrlResponse(scheme_name=best.get('scheme_name') or q, url=url)

    # Fallback: ask Gemini for a single official URL
    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        return ResolveUrlResponse(scheme_name=q, url=None)

@router.post("/enrich", response_model=EnrichResponse)
async def enrich_schemes(request: EnrichRequest):
    """Given scheme names, return short description + a single apply URL for each using Gemini (fallback to CSV fields)."""
    csv_path = request.csv_path or os.getenv("SCHEMES_CSV") or str(Path(__file__).resolve().parents[1] / "schemes.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"schemes.csv not found at {csv_path}")

    # Load CSV into memory for matching
    rows: List[Dict[str, Any]] = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    def best_row(name: str) -> Optional[Dict[str, Any]]:
        best = None; best_score = -1
        for r in rows:
            n = (r.get('scheme_name') or '').strip()
            s = difflib.SequenceMatcher(None, name.lower(), n.lower()).ratio()
            if name.lower() in n.lower():
                s += 0.5
            if s > best_score:
                best_score = s; best = r
        return best

    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    gen_model = None
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            gen_model = genai.GenerativeModel("gemini-1.5-flash")
        except Exception:
            gen_model = None

    enriched: List[EnrichedScheme] = []
    import re
    url_re = re.compile(r"(https?://[^\s\)]+)")

    for it in request.items:
        row = best_row(it.scheme_name) if request.items else None
        # Defaults from CSV
        csv_desc = (row.get('details') or row.get('description') or '') if row else ''
        csv_url = None
        if row:
            for k in ['application','official_url','application_link','url','link','Apply','Application','URL','Link','Official_URL']:
                v = row.get(k)
                if v and str(v).strip():
                    csv_url = str(v).strip(); break
        answer_desc = None
        answer_url = None

        if gen_model:
            try:
                context = it.context or ''
                if row and not context:
                    context = f"Details: {(row.get('details') or '')}\nEligibility: {(row.get('eligibility') or '')}"
                prompt = (
                    "You will be given the name of an Indian government (central/state) scheme.\n"
                    "Return two things ONLY, as plain text (no bullets, no markdown):\n"
                    "1) A one-sentence description (<=35 words)\n"
                    "2) The single most likely OFFICIAL application/landing URL. STRICT PREFERENCE ORDER: (1) .gov.in/.nic.in, (2) https://www.india.gov.in/my-government/schemes-0 entries, (3) state .gov.in portals. If unsure, 'none'.\n\n"
                    f"Scheme Name: {it.scheme_name}\n"
                    f"Context (may be partial):\n{context}\n"
                    "Format:\nDescription: <text>\nURL: <url or none>\n"
                )
                resp = gen_model.generate_content(prompt)
                text = (resp.text or '').strip()
                # Parse desc and URL lines
                desc = None; url = None
                for line in text.splitlines():
                    if line.lower().startswith('description:'):
                        desc = line.split(':',1)[1].strip()
                    if line.lower().startswith('url:'):
                        maybe = line.split(':',1)[1].strip()
                        m = url_re.search(maybe)
                        if m:
                            url = m.group(1)
                        elif maybe.lower() != 'none' and maybe:
                            url = maybe
                answer_desc = desc
                answer_url = url
            except Exception:
                pass

        # Fallbacks
        if not answer_desc:
            answer_desc = csv_desc[:200] if csv_desc else None
        if not answer_url and csv_url:
            # normalize
            u = csv_url.strip('"')
            if u and not u.startswith('http') and not ' ' in u:
                u = 'https://' + u if not u.startswith('www.') else 'https://' + u
            answer_url = u

        enriched.append(EnrichedScheme(scheme_name=row.get('scheme_name') if row else it.scheme_name,
                                       description=answer_desc,
                                       apply_url=answer_url))

    return EnrichResponse(enriched=enriched)
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "Return ONLY the single most likely OFFICIAL application or scheme landing URL for the scheme name below.\n"
            "STRICT PREFERENCE ORDER: (1) .gov.in or .nic.in domains, (2) https://www.india.gov.in/my-government/schemes-0 entries, (3) state govt portals (.gov.in).\n"
            "If unsure, return just 'none'. Do not include any explanation, markdown or extra text.\n\n"
            f"Scheme Name: {q}\n"
        )
        resp = model.generate_content(prompt)
        text = (resp.text or '').strip()
        # Extract first URL-like token
        import re
        m = re.search(r"(https?://[^\s\)]+)", text)
        if m:
            return ResolveUrlResponse(scheme_name=q, url=m.group(1))
    except Exception:
        pass
    return ResolveUrlResponse(scheme_name=q, url=None)

@router.post("/chat", response_model=ChatResponse)
async def chat_with_gemini(request: ChatRequest):
    """Gemini-powered chat endpoint that grounds on schemes CSV whenever needed."""
    # Load CSV
    df = _load_schemes_csv(request.csv_path)
    # Filter candidates based on provided attributes or last user message as query
    last_user = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
    candidates = _filter_schemes(
        df,
        name_query=last_user,
        state=request.state,
        sector=request.sector,
        income_level=request.income_level,
        tags=request.tags,
        limit=request.limit,
    )
    context_block = _format_schemes_for_context(candidates)

    # Prepare Gemini prompt
    sys_instructions = (
        "You are Yojana Mitra, an assistant for Indian government schemes.\n"
        "Always ground your responses ONLY in the provided CSV context.\n"
        "When user details are missing (name, age, sector, income level, state), ask precise follow-up questions.\n"
        "When enough info is present, propose top 3-5 eligible schemes with short justifications and include application links when available.\n"
        "If context lacks the answer, say you don't have enough information and ask for clarifications.\n"
        "Keep responses concise and list-like with clear headings and bullet points."
    )

    # Build conversation text for Gemini
    convo_text = [f"System: {sys_instructions}"]
    if request.name:
        convo_text.append(f"System: User name is {request.name}.")
    if request.age is not None:
        convo_text.append(f"System: User age is {request.age}.")
    if request.sector:
        convo_text.append(f"System: User sector is {request.sector}.")
    if request.income_level:
        convo_text.append(f"System: User income level is {request.income_level}.")
    if request.state:
        convo_text.append(f"System: User state is {request.state}.")

    for m in request.messages:
        role = "User" if m.role == "user" else ("Assistant" if m.role == "assistant" else "System")
        convo_text.append(f"{role}: {m.content}")

    convo_text.append("\nContext from CSV (use strictly):\n" + context_block)
    prompt = "\n\n".join(convo_text)

    # Call Gemini
    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        # Fallback: return extractive summary from context
        fallback = "Could not access Gemini. Here are some schemes from the dataset you may review:\n\n" + context_block
        # Prepare recommended list
        recs: List[Dict[str, Any]] = []
        for _, r in candidates.iterrows():
            recs.append({
                "scheme_name": r.get('scheme_name', ''),
                "state": r.get('state', ''),
                "category": r.get('schemeCategory', ''),
                "eligibility": r.get('eligibility', ''),
                "benefits": r.get('benefits', ''),
                "application": r.get('application', '') or r.get('official_url', ''),
            })
        return ChatResponse(reply=fallback, recommended=recs)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        text = resp.text if hasattr(resp, 'text') else str(resp)
    except Exception as e:
        # Fallback on error
        text = f"Gemini error: {e}.\n\nHere are some schemes based on your info:\n\n{context_block}"

    # Prepare recommended list from candidates for UI to render
    recommended: List[Dict[str, Any]] = []
    for _, r in candidates.iterrows():
        recommended.append({
            "scheme_name": r.get('scheme_name', ''),
            "state": r.get('state', ''),
            "category": r.get('schemeCategory', ''),
            "eligibility": r.get('eligibility', ''),
            "benefits": r.get('benefits', ''),
            "application": r.get('application', '') or r.get('official_url', ''),
        })

    return ChatResponse(reply=text, recommended=recommended)
@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """Query the FAISS index for similar documents."""
    try:
        # Check if index exists
        if faiss_handler.index is None:
            # Try to load existing index
            if not faiss_handler.load_index():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No FAISS index found. Please ingest data first using /ingest endpoint."
                )
        
        # Generate query embedding
        query_embedding = embedding_service.embed_query(request.query)
        
        # Search for similar documents
        results = faiss_handler.search(query_embedding, request.k)
        
        # Format results
        formatted_results = []
        for i, (score, text) in enumerate(results):
            # Extract scheme name if available
            scheme_name = "Unknown Scheme"
            if "Scheme:" in text:
                try:
                    scheme_part = text.split("Scheme:")[1].split("|")[0].strip()
                    scheme_name = scheme_part[:100] + "..." if len(scheme_part) > 100 else scheme_part
                except:
                    pass
            
            formatted_results.append({
                "rank": i + 1,
                "score": score,
                "similarity": f"{score:.4f}",
                "scheme_name": scheme_name,
                "content": text,
                "preview": text[:200] + "..." if len(text) > 200 else text
            })
        
        return QueryResponse(
            results=formatted_results,
            query=request.query,
            k=request.k
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during query: {str(e)}"
        )

@router.get("/status")
async def get_status():
    """Get the current status of the system."""
    index_size = faiss_handler.get_index_size() if faiss_handler.index else 0
    index_loaded = faiss_handler.index is not None
    
    return {
        "index_loaded": index_loaded,
        "index_size": index_size,
        "embedding_service_ready": True
    }
