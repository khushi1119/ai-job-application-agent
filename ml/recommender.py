#!/usr/bin/env python3
"""
Production ML Job Recommender using TF-IDF and Cosine Similarity.
Reads a single JSON payload from stdin and writes JSON results to stdout.
Diagnostics and logs are strictly sent to stderr to keep stdout JSON clean.
"""

import sys
import json
import re
from typing import List, Dict, Any, Tuple

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError as e:
    sys.stderr.write(f"ERROR: Missing scikit-learn or dependencies: {e}\n")
    sys.stdout.write(json.dumps({"success": False, "error": "scikit-learn is not installed in the Python environment"}))
    sys.exit(1)


# Common technical skill aliases for text normalization
SKILL_ALIASES = [
    (r"\b(react\.js|reactjs)\b", "react"),
    (r"\b(node\.js|nodejs)\b", "node"),
    (r"\b(vue\.js|vuejs)\b", "vue"),
    (r"\b(next\.js|nextjs)\b", "next"),
    (r"\b(angular\.js|angularjs)\b", "angular"),
    (r"\b(postgresql)\b", "postgres"),
    (r"\b(k8s)\b", "kubernetes"),
    (r"\b(golang)\b", "go"),
    (r"\b(mongo|mongod)\b", "mongodb"),
    (r"\b(aws|amazon web services)\b", "aws"),
    (r"\b(gcp|google cloud platform)\b", "gcp"),
]


def normalize_text(text: str) -> str:
    """Lowercase and normalize technical aliases."""
    if not text or not isinstance(text, str):
        return ""
    normalized = text.lower()
    for pattern, replacement in SKILL_ALIASES:
        normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
    return normalized


def build_candidate_document(candidate: Dict[str, Any]) -> Tuple[str, List[str]]:
    """
    Build a weighted textual representation of the candidate profile.
    Skills are repeated 3x to ensure core competencies dominate TF-IDF scoring.
    Returns (candidate_text, normalized_candidate_skills_list).
    """
    parts: List[str] = []

    # 1. Skills (Highest weight: 3x multiplier)
    raw_skills = candidate.get("skills", [])
    clean_skills = [str(s).strip() for s in raw_skills if str(s).strip()]
    if clean_skills:
        skills_str = " ".join(clean_skills)
        parts.append(skills_str)
        parts.append(skills_str)
        parts.append(skills_str)

    # 2. Professional summary
    summary = candidate.get("summary", "")
    if summary and isinstance(summary, str):
        parts.append(summary.strip())

    # 3. Education (Degree, field of study, and institution)
    education_list = candidate.get("education", [])
    if isinstance(education_list, list):
        for edu in education_list:
            if not isinstance(edu, dict):
                continue
            degree = str(edu.get("degree", "")).strip()
            field = str(edu.get("fieldOfStudy", "")).strip()
            institution = str(edu.get("institution", "")).strip()
            if degree or field:
                edu_text = f"{degree} {field}".strip()
                # Weight degree and field of study 2x
                parts.append(f"{edu_text} {edu_text}")
            if institution:
                parts.append(institution)

    # 4. Work experience (Roles, highlights, and technologies)
    experience_list = candidate.get("experience", [])
    if isinstance(experience_list, list):
        for exp in experience_list:
            if not isinstance(exp, dict):
                continue
            role = exp.get("role", "")
            if role:
                parts.append(f"{role} {role}")  # Weight role title 2x
            techs = exp.get("technologies", [])
            if isinstance(techs, list) and techs:
                parts.append(" ".join(str(t) for t in techs if str(t).strip()))
            highlights = exp.get("highlights", [])
            if isinstance(highlights, list) and highlights:
                parts.append(" ".join(str(h) for h in highlights if str(h).strip()))

    # 5. Projects (Titles, descriptions, and technologies)
    project_list = candidate.get("projects", [])
    if isinstance(project_list, list):
        for proj in project_list:
            if not isinstance(proj, dict):
                continue
            title = proj.get("title", "")
            if title:
                parts.append(title)
            desc = proj.get("description", "")
            if desc:
                parts.append(desc)
            techs = proj.get("technologies", [])
            if isinstance(techs, list) and techs:
                parts.append(" ".join(str(t) for t in techs if str(t).strip()))

    # 6. Parsed resume text (capped at 2500 characters to retain structured skills balance)
    raw_text = candidate.get("rawText", "")
    if raw_text and isinstance(raw_text, str):
        cleaned_raw = raw_text.strip()[:2500]
        if cleaned_raw:
            parts.append(cleaned_raw)

    full_text = normalize_text(" ".join(parts))
    return full_text, clean_skills


COMMON_NON_SKILLS = {
    "team", "work", "communication", "years", "time", "lead", "leadership",
    "management", "problem", "solving", "help", "good", "great", "english",
    "developer", "engineer", "software", "code", "tech", "technology"
}


def build_job_document(job: Dict[str, Any]) -> str:
    """
    Build a weighted textual representation of a job listing.
    Title and requirements are repeated 2x to prioritize key responsibilities.
    Description is bounded to 2500 characters to prevent legal boilerplate dilution.
    """
    parts: List[str] = []

    # 1. Job Title (Weighted 2x)
    title = str(job.get("title", "")).strip()
    if title:
        parts.append(f"{title} {title}")

    # 2. Extracted Requirements (Weighted 2x)
    requirements = job.get("requirements", [])
    if isinstance(requirements, list) and requirements:
        req_str = " ".join(str(r).strip() for r in requirements if str(r).strip())
        if req_str:
            parts.append(req_str)
            parts.append(req_str)

    # 3. Job Description (capped at 2500 characters to preserve signal & speed up TF-IDF)
    desc = str(job.get("description", "")).strip()[:2500]
    if desc:
        parts.append(desc)

    return normalize_text(" ".join(parts))


def extract_matched_skills(candidate_skills: List[str], job_text: str) -> List[str]:
    """
    Identify candidate skills that explicitly appear within the job listing text.
    Uses strict whole-word boundary regex and excludes generic non-technical filler words.
    """
    if not candidate_skills or not job_text:
        return []

    matched = []
    job_lower = job_text.lower()

    for skill in candidate_skills:
        skill_str = str(skill).strip()
        if not skill_str or len(skill_str) < 2:
            continue

        skill_lower = skill_str.lower()
        if skill_lower in COMMON_NON_SKILLS:
            continue

        # Two-letter technical skills (e.g. go, c, r, ui, ux, ai) require strict handling
        if len(skill_lower) <= 2:
            if skill_lower == "go":
                # Match only explicit golang or 'go language' or 'go/' or '/go'
                if re.search(r"\b(golang|go language|go programming)\b", job_lower) or re.search(r"\bgo\s*/", job_text):
                    matched.append(skill_str)
            elif skill_lower in ("ui", "ux", "ai", "ml", "qa", "db", "ci", "cd"):
                pattern = r"\b" + re.escape(skill_lower) + r"\b"
                if re.search(pattern, job_lower):
                    matched.append(skill_str)
            continue

        # Standard technical skills: require exact whole word/phrase match with word boundaries
        pattern = r"\b" + re.escape(skill_lower) + r"\b"
        if re.search(pattern, job_lower):
            matched.append(skill_str)

    return list(dict.fromkeys(matched))  # Deduplicate preserving order


def main():
    try:
        raw_input = sys.stdin.read()
    except Exception as e:
        sys.stderr.write(f"Failed to read from stdin: {e}\n")
        sys.stdout.write(json.dumps({"success": False, "error": f"Stdin read error: {e}"}))
        sys.exit(1)

    if not raw_input or not raw_input.strip():
        sys.stderr.write("Empty input received on stdin\n")
        sys.stdout.write(json.dumps({
            "success": True,
            "recommendations": [],
            "totalEvaluated": 0,
            "message": "Empty input"
        }))
        return

    try:
        data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON decode error: {e}\n")
        sys.stdout.write(json.dumps({"success": False, "error": f"Malformed JSON: {e}"}))
        sys.exit(1)

    candidate = data.get("candidate", {})
    jobs = data.get("jobs", [])
    options = data.get("options", {})
    top_k = int(options.get("topK", 20))
    min_score = float(options.get("minScore", 0.0))

    if not isinstance(jobs, list) or len(jobs) == 0:
        sys.stdout.write(json.dumps({
            "success": True,
            "recommendations": [],
            "totalEvaluated": 0,
            "message": "No jobs provided for evaluation"
        }))
        return

    candidate_doc, candidate_skills = build_candidate_document(candidate)

    if not candidate_doc.strip():
        sys.stderr.write("Candidate profile has no usable skills, summary, or text.\n")
        sys.stdout.write(json.dumps({
            "success": True,
            "recommendations": [],
            "totalEvaluated": len(jobs),
            "emptyCandidate": True,
            "message": "Candidate profile contains no text or skills to match against."
        }))
        return

    job_docs = []
    job_ids = []
    job_map = {}

    for j in jobs:
        j_id = str(j.get("id") or j.get("_id") or "").strip()
        if not j_id:
            continue
        job_ids.append(j_id)
        doc = build_job_document(j)
        job_docs.append(doc)
        job_map[j_id] = (j, doc)

    if not job_ids:
        sys.stdout.write(json.dumps({
            "success": True,
            "recommendations": [],
            "totalEvaluated": 0,
            "message": "No valid job IDs found"
        }))
        return

    all_docs = [candidate_doc] + job_docs

    try:
        # Use English stop words, unigram + bigram n-grams, max 10000 features
        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_features=10000,
            sublinear_tf=True
        )
        tfidf_matrix = vectorizer.fit_transform(all_docs)

        candidate_vector = tfidf_matrix[0]
        job_vectors = tfidf_matrix[1:]

        cosine_sims = cosine_similarity(candidate_vector, job_vectors)[0]
    except ValueError as val_err:
        # Happens if all words in all documents are stop words or vocabulary is empty
        sys.stderr.write(f"TF-IDF Vectorizer warning: {val_err}\n")
        cosine_sims = [0.0] * len(job_ids)
    except Exception as exc:
        sys.stderr.write(f"Error during vectorization: {exc}\n")
        sys.stdout.write(json.dumps({"success": False, "error": f"Vectorization error: {exc}"}))
        sys.exit(1)

    scored_results = []
    for idx, j_id in enumerate(job_ids):
        score = float(cosine_sims[idx]) if idx < len(cosine_sims) else 0.0
        if score < min_score:
            continue

        orig_job, orig_job_doc = job_map[j_id]
        matched_skills = extract_matched_skills(candidate_skills, orig_job_doc)
        
        # Round score to 4 decimals, percentage to integer (0 - 100)
        percentage = min(100, max(0, int(round(score * 100))))

        scored_results.append({
            "jobId": j_id,
            "score": round(score, 4),
            "matchPercentage": percentage,
            "matchedSkills": matched_skills,
        })

    # Sort descending by similarity score
    scored_results.sort(key=lambda item: item["score"], reverse=True)

    # Slice top_k
    recommendations = scored_results[:top_k]

    output = {
        "success": True,
        "recommendations": recommendations,
        "totalEvaluated": len(job_ids),
        "totalMatches": len(scored_results),
    }

    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
