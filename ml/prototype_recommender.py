"""
=============================================================================
Educational Prototype: Resume-to-Job Matching using TF-IDF & Cosine Similarity
=============================================================================

This is a standalone educational script demonstrating how Machine Learning (ML)
and Natural Language Processing (NLP) can match candidate profiles with job
descriptions based on text similarity.

KEY CONCEPTS EXPLAINED FOR BEGINNERS:
-------------------------------------
1. TEXT VECTORIZATION:
   Computers cannot directly understand words or sentences. Vectorization is
   the process of converting human-readable text into a list of numbers
   (a "vector") so that mathematical algorithms can compare them.

2. TF-IDF (Term Frequency - Inverse Document Frequency):
   - Term Frequency (TF): Measures how often a word appears in a specific document.
     If "React" appears multiple times in a candidate's profile, it is deemed important.
   - Inverse Document Frequency (IDF): Decreases the weight of words that appear in
     almost every document (e.g., "the", "work", "job", "experience"). Words that
     appear rarely across the whole corpus (e.g., "TypeScript", "Tailwind", "Kubernetes")
     receive a much higher score because they are unique and informative.

3. COSINE SIMILARITY:
   - Once texts are converted into numerical vectors in a multi-dimensional space,
     cosine similarity measures the cosine of the angle between two vectors.
   - Score of 1.0 (100%): The two vectors point in the exact same direction (perfect match).
   - Score of 0.0 (0%): The vectors are completely orthogonal (share no relevant terms).
   - Why Cosine Similarity? It is length-invariant. A candidate with a concise 1-page
     resume will not be unfairly penalized compared to a long 5-page job description.

IMPORTANT DISCLAIMER:
---------------------
Cosine similarity measures *lexical text similarity*, NOT hiring probability or
actual job qualification. A high score means the vocabulary overlaps significantly;
it does not account for interview performance, portfolio quality, or soft skills.
=============================================================================
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def run_prototype():
    print("=" * 70)
    print(" AI Job Application Agent - ML Recommendation Prototype (Educational)")
    print("=" * 70)
    print()

    # -------------------------------------------------------------------------
    # STEP 1: Synthetic Example Data
    # -------------------------------------------------------------------------
    # In this isolated learning prototype, we use safe synthetic data instead
    # of real user documents or database queries.

    candidate_profile = {
        "name": "Jordan Lee (Synthetic Candidate)",
        "headline": "Frontend React Developer",
        "skills": ["JavaScript", "TypeScript", "React", "Next.js", "Redux", "Tailwind CSS", "HTML5", "REST APIs"],
        "summary": "Frontend developer specializing in building responsive web applications with React, Next.js, and TypeScript. Experienced in modern UI styling with Tailwind CSS and state management using Redux.",
    }

    job_descriptions = [
        {
            "id": "job-001",
            "title": "Senior Frontend Engineer",
            "company": "TechCorp Solutions",
            "role_type": "Frontend (Strong Match)",
            "description": "We are seeking a talented Senior Frontend Engineer to build high-performance web applications. The ideal candidate has deep expertise in JavaScript, TypeScript, React, Next.js, and Tailwind CSS. Experience with RESTful APIs, modern component design, and state management is required.",
        },
        {
            "id": "job-002",
            "title": "Backend Systems Engineer",
            "company": "CloudData Systems",
            "role_type": "Backend (Partial / Low Match)",
            "description": "Join our infrastructure engineering team building scalable distributed microservices. Requirements: 3+ years experience with Python, Django, PostgreSQL, Docker, Kubernetes, and AWS cloud architecture. Experience with database optimization and Linux server environments.",
        },
        {
            "id": "job-003",
            "title": "Executive Pastry Chef",
            "company": "Artisan Bakery & Cafe",
            "role_type": "Unrelated (Zero / Negligible Match)",
            "description": "Artisan Bakery is looking for an Executive Pastry Chef to manage kitchen operations, design dessert menus, supervise food safety compliance, and oversee daily inventory orders for flour, dairy, and culinary supplies.",
        },
    ]

    # -------------------------------------------------------------------------
    # STEP 2: Feature Representation (Combining Profile Text)
    # -------------------------------------------------------------------------
    # We combine the candidate's skills and summary into a single unified
    # text document. Notice that we emphasize skills by giving them natural presence.
    skills_text = " ".join(candidate_profile["skills"])
    candidate_text = f"{candidate_profile['headline']} {skills_text} {candidate_profile['summary']}"

    # Prepare list of job description texts
    job_texts = [job["description"] for job in job_descriptions]

    print("[1] PREPARING INPUT DOCUMENTS:")
    print(f"    Candidate: {candidate_profile['name']} ({candidate_profile['headline']})")
    print(f"    Skills:    {', '.join(candidate_profile['skills'])}")
    print(f"    Jobs To Evaluate: {len(job_descriptions)} synthetic listings")
    print("-" * 70)

    # -------------------------------------------------------------------------
    # STEP 3: Vectorization with TfidfVectorizer
    # -------------------------------------------------------------------------
    # - stop_words='english': Automatically filters out words like 'the', 'is', 'in'.
    # - ngram_range=(1, 2): Captures single words ("react") AND two-word phrases ("next js", "tailwind css").
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))

    # All documents (1 candidate profile + 3 job descriptions) are passed together
    # to learn the global vocabulary and Inverse Document Frequency (IDF) weights.
    all_documents = [candidate_text] + job_texts
    tfidf_matrix = vectorizer.fit_transform(all_documents)

    # Candidate vector is at index 0, job vectors are at indices 1, 2, 3
    candidate_vector = tfidf_matrix[0]
    job_vectors = tfidf_matrix[1:]

    print("\n[2] VECTORIZATION METRICS:")
    print(f"    Vocabulary Size: {len(vectorizer.get_feature_names_out())} unique n-gram features learned.")
    print(f"    TF-IDF Matrix Shape: {tfidf_matrix.shape} (documents x features)")
    print("-" * 70)

    # -------------------------------------------------------------------------
    # STEP 4: Compute Cosine Similarity
    # -------------------------------------------------------------------------
    # cosine_similarity compares the candidate vector against each job vector.
    # It returns a 2D array of scores between 0.0 and 1.0.
    similarity_scores = cosine_similarity(candidate_vector, job_vectors)[0]

    # -------------------------------------------------------------------------
    # STEP 5: Rank and Display Results
    # -------------------------------------------------------------------------
    ranked_results = []
    for idx, job in enumerate(job_descriptions):
        score = float(similarity_scores[idx])
        ranked_results.append({
            "job": job,
            "score": score,
            "percentage": f"{score * 100:.1f}%",
        })

    # Sort descending: highest similarity score first
    ranked_results.sort(key=lambda x: x["score"], reverse=True)

    print("\n[3] RECOMMENDATION RANKING RESULTS:")
    print(f"{'Rank':<5} | {'Job Title':<30} | {'Role Category':<28} | {'Match Score':<12}")
    print("-" * 80)

    for rank, item in enumerate(ranked_results, 1):
        job = item["job"]
        print(f"#{rank:<4} | {job['title']:<30} | {job['role_type']:<28} | {item['percentage']:<12} ({item['score']:.4f})")

    print("-" * 80)

    # -------------------------------------------------------------------------
    # STEP 6: Educational Interpretation of the Output
    # -------------------------------------------------------------------------
    print("\n[4] EDUCATIONAL BREAKDOWN:")
    top_job = ranked_results[0]
    bottom_job = ranked_results[-1]
    print(f"  * Top Match: '{top_job['job']['title']}' scored {top_job['percentage']}.")
    print("    Why? Strong lexical overlap on critical technical terms (React, Next.js, TypeScript, Tailwind CSS).")
    print(f"  * Lowest Match: '{bottom_job['job']['title']}' scored {bottom_job['percentage']}.")
    print("    Why? Culinary and pastry keywords share zero intersection with frontend engineering vocabulary.")
    print("\n  * KEY TAKEAWAY:")
    print("    TF-IDF + Cosine Similarity creates a fast, interpretable text-relevance baseline.")
    print("    It ranks jobs strictly by vocabulary alignment. In future steps, this score can be")
    print("    combined with location preferences and seniority filters to provide smart recommendations.")
    print("=" * 70)


if __name__ == "__main__":
    run_prototype()
