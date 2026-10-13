/**
 * careerDomainClassifier.js
 * Explainable domain detection for candidate profiles and job listings.
 *
 * Supported Domains:
 * - 'tech': Software, Web, Mobile, Cloud, DevOps, Infrastructure, QA/SDET
 * - 'data': Data Science, Machine Learning, AI, Analytics, Business Intelligence
 * - 'finance': Accounting, Banking, Auditing, Taxation, Corporate Finance, Commerce
 * - 'business': Operations, Product Management, Strategy, Consulting, Project Management
 * - 'marketing_hr': Human Resources, Talent Acquisition, Marketing, Content, PR, Brand
 * - 'all': Mixed, general, or unclassified
 */

export const CAREER_DOMAINS = {
  TECH: 'tech',
  DATA: 'data',
  FINANCE: 'finance',
  BUSINESS: 'business',
  MARKETING_HR: 'marketing_hr',
  ALL: 'all',
};

export const DOMAIN_LABELS = {
  tech: 'Software & IT',
  data: 'Data & Analytics',
  finance: 'Finance & Commerce',
  business: 'Business & Management',
  marketing_hr: 'Marketing & HR',
  all: 'All Domains',
};

// --- Vocabulary Signals ---

const TECH_SKILLS = new Set([
  'javascript', 'typescript', 'react', 'react.js', 'reactjs', 'node', 'node.js', 'nodejs',
  'express', 'express.js', 'next.js', 'nextjs', 'vue', 'vue.js', 'angular', 'html', 'css',
  'tailwind', 'bootstrap', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby',
  'php', 'swift', 'kotlin', 'mongodb', 'postgresql', 'postgres', 'mysql', 'sql', 'redis',
  'docker', 'kubernetes', 'k8s', 'aws', 'amazon web services', 'gcp', 'google cloud',
  'azure', 'ci/cd', 'git', 'github', 'rest api', 'graphql', 'graphql api', 'microservices',
  'linux', 'devops', 'sre', 'qa', 'sdet', 'selenium', 'cypress', 'jest', 'unit testing',
  'object-oriented programming', 'oop', 'data structures', 'algorithms', 'dsa', 'system design',
  'mern', 'mean', 'full stack', 'fullstack', 'frontend', 'backend', 'web development',
]);

const DATA_SKILLS = new Set([
  'data science', 'machine learning', 'ml', 'deep learning', 'artificial intelligence', 'ai',
  'nlp', 'natural language processing', 'computer vision', 'pandas', 'numpy', 'scipy',
  'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'r', 'tableau', 'power bi', 'powerbi',
  'data analytics', 'data analysis', 'sql', 'big data', 'hadoop', 'spark', 'pyspark',
  'etl', 'data warehousing', 'snowflake', 'databricks', 'statistics', 'statistical modeling',
  'mathematics', 'predictive modeling', 'data visualization',
]);

const FINANCE_SKILLS = new Set([
  'accounting', 'financial accounting', 'cost accounting', 'management accounting',
  'auditing', 'internal audit', 'external audit', 'taxation', 'direct tax', 'indirect tax',
  'gst', 'tds', 'income tax', 'tally', 'tally erp', 'tally prime', 'quickbooks', 'sap fico',
  'financial modeling', 'financial analysis', 'corporate finance', 'valuation', 'banking',
  'investment banking', 'wealth management', 'portfolio management', 'equity research',
  'balance sheet', 'profit and loss', 'general ledger', 'accounts payable', 'accounts receivable',
  'reconciliation', 'payroll', 'budgeting', 'forecasting', 'chartered accountancy', 'ca',
  'cpa', 'cma', 'cfa', 'ifrs', 'gaap', 'financial reporting', 'treasury',
]);

const BUSINESS_SKILLS = new Set([
  'business administration', 'business management', 'operations management', 'operations',
  'project management', 'program management', 'product management', 'agile', 'scrum',
  'jira', 'confluence', 'business analysis', 'business analytics', 'strategy', 'strategic planning',
  'supply chain', 'logistics', 'procurement', 'vendor management', 'process improvement',
  'six sigma', 'lean', 'risk management', 'stakeholder management', 'client relations',
  'consulting', 'management consulting', 'leadership', 'team management', 'cross-functional leadership',
]);

const MARKETING_HR_SKILLS = new Set([
  'human resources', 'hr', 'talent acquisition', 'recruitment', 'sourcing', 'hiring',
  'interviewing', 'onboarding', 'employee engagement', 'performance management',
  'hr policies', 'labor laws', 'people management', 'digital marketing', 'marketing',
  'seo', 'sem', 'content marketing', 'content writing', 'copywriting', 'social media',
  'social media marketing', 'smm', 'email marketing', 'google ads', 'meta ads',
  'brand management', 'public relations', 'pr', 'creative writing', 'video editing',
  'graphic design', 'communications', 'corporate communications',
]);

// Degree Patterns
const DEGREE_PATTERNS = [
  { domain: 'tech', pattern: /\b(b\.?tech|b\.?e\.?|bca|mca|m\.?tech|computer science|information technology|software engineering|computer engineering|computational)\b/i },
  { domain: 'data', pattern: /\b(data science|data analytics|statistics|applied mathematics|computational statistics|machine learning)\b/i },
  { domain: 'finance', pattern: /\b(b\.?com|m\.?com|chartered accountant|ca\b|cpa\b|cma\b|cfa\b|accounting|commerce|finance|banking|taxation)\b/i },
  { domain: 'business', pattern: /\b(bba|mba|bms|pgdm|business administration|management studies|operations management|international business)\b/i },
  { domain: 'marketing_hr', pattern: /\b(human resources|hr\b|marketing|mass communication|journalism|public relations|advertising)\b/i },
];

// Negative override patterns: Detect explicit non-tech domains where generic terms
// like "frontend", "backend", "web", "associate", "manager", or "platform" might appear.
export const NON_TECH_OVERRIDE_PATTERNS = [
  {
    domain: 'finance',
    pattern: /\b(collection(s)?|lending collection(s)?|debt recovery|delinquency|loan recovery|accounts payable|accounts receivable|billing|payroll|audit|auditor|tax|taxation|chartered accountant|cfo)\b/i,
  },
  {
    domain: 'marketing_hr',
    pattern: /\b(graphic design(er)?|web graphic design(er)?|visual design(er)?|brand design(er)?|illustrator|art director|creative director|motion design(er)?|animator|recruiter|recruitment|talent acquisition|human resources|hr\b|people operations)\b/i,
  },
  {
    domain: 'business',
    pattern: /\b(operations manager|operations associate|operations lead|data operations manager|ai operations|store manager|branch manager|area manager|relationship manager|bdr|sdr|account executive|account manager|sales manager|customer support)\b/i,
  },
];

// Title Patterns for Job Classification
export const JOB_TITLE_PATTERNS = [
  {
    domain: 'data',
    pattern: /\b(data scientist|data engineer|data analyst|machine learning engineer|ml engineer|ai engineer|artificial intelligence engineer|deep learning engineer|nlp engineer|computer vision engineer|bi analyst|business intelligence analyst|analytics engineer|statistician)\b/i,
  },
  {
    domain: 'tech',
    pattern: /\b(software|developer|engineer|full-?stack|full\s*stack|frontend|front-end|backend|back-end|devops|sre|site reliability|qa\b|sdet|quality assurance|cloud engineer|infrastructure engineer|systems? engineer|programmer|coder|react|node|python developer|java developer|golang|ruby developer|ios developer|android developer|mobile developer|security engineer|database admin|dba|it support|tech lead|technical lead|architect|ai platform engineer|platform engineer|web (developer|development|engineer|app))\b/i,
  },
  {
    domain: 'finance',
    pattern: /\b(finance|financial|accountant|accounting|audit|auditor|tax|taxation|treasury|controller|billing|payroll|accounts payable|accounts receivable|wealth|banking|actuary|chartered accountant|cfo|collection(s)?|lending collection(s)?|debt recovery)\b/i,
  },
  {
    domain: 'marketing_hr',
    pattern: /\b(recruiter|recruitment|talent|hr\b|human resources|people (operations|team|partner|lead|specialist)|onboarding|marketing|brand|communications|content|copywriter|social media|seo|growth marketing|public relations|pr\b|creative|video editor|graphic design(er)?|web graphic design(er)?|visual design(er)?|illustrator|art director)\b/i,
  },
  {
    domain: 'business',
    pattern: /\b(operations|program manager|product manager|associate product manager|business operations|strategy|consultant|project manager|business analyst|supply chain|logistics|procurement|growth manager|commercial|account executive|account manager|sales|business development|bdr|sdr|partnerships|customer success|customer support)\b/i,
  },
];

/**
 * Returns a MongoDB-compatible regex pattern for filtering jobs by domain.
 * For 'tech', broadens to include software, IT, QA, and data/AI opportunities,
 * while strictly excluding loan recovery collections and graphic design roles.
 *
 * @param {string} domain - Domain key ('tech', 'data', 'finance', 'business', 'marketing_hr', 'all')
 * @returns {RegExp|null}
 */
export const getDomainTitleRegex = (domain) => {
  switch (domain) {
    case 'tech':
      // Software, IT, Cloud, QA, and Data/AI/ML engineering opportunities.
      // Negative lookahead guarantees that collections, debt recovery, and graphic design never match tech.
      return /^(?!.*(collection|recovery|delinquency|graphic design|illustrator|art director|visual designer))\b.*(software|developer|fullstack|full-stack|devops|sre|qa\b|sdet|quality assurance|cloud engineer|infrastructure engineer|systems? engineer|programmer|coder|react|node|python developer|java developer|golang|ruby developer|ios developer|android developer|mobile developer|security engineer|database admin|dba|it support|tech lead|architect|data scientist|data engineer|data analyst|machine learning|ml engineer|ai engineer|ai platform engineer|frontend|backend|web (developer|development|engineer|app))\b/i;
    case 'data':
      return /\b(data scientist|data engineer|data analyst|machine learning engineer|ml engineer|ai engineer|artificial intelligence engineer|deep learning|nlp|computer vision|bi analyst|business intelligence|analytics engineer|statistician)\b/i;
    case 'finance':
      return /\b(finance|financial|accountant|accounting|audit|auditor|tax|taxation|treasury|controller|billing|payroll|accounts payable|accounts receivable|wealth|banking|actuary|chartered accountant|cfo|commerce|collection(s)?|lending collection(s)?|debt recovery)\b/i;
    case 'business':
      return /\b(operations|program manager|product manager|associate product manager|business operations|strategy|consultant|project manager|business analyst|supply chain|logistics|procurement|growth manager|commercial|account executive|account manager|sales|business development|bdr|sdr|partnerships|customer success|customer support)\b/i;
    case 'marketing_hr':
      return /\b(recruiter|recruitment|talent|hr\b|human resources|people team|onboarding|marketing|brand|communications|content|copywriter|social media|seo|growth marketing|public relations|pr\b|creative|video editor|graphic design(er)?|web graphic design(er)?|visual design(er)?|illustrator)\b/i;
    case 'all':
    default:
      return null;
  }
};

// Explicit Technical Responsibilities Patterns
const TECH_RESPONSIBILITIES_PATTERN =
  /\b(writing (clean )?code|software development|develop(ing)? (software|features|applications|apis|services|components)|building (apis|microservices|web applications|scalable systems)|ci\/cd|unit test(ing)?|code review(s)?|system design|data structures|algorithms|debugging|deploy(ing)? (software|applications|containers))\b/i;

const DATA_RESPONSIBILITIES_PATTERN =
  /\b(train(ing)? models?|machine learning models?|neural networks|deep learning|data pipelines?|feature engineering|model deployment|llm(s)?|fine-tuning|statistical analysis|predictive models?)\b/i;

const FINANCE_RESPONSIBILITIES_PATTERN =
  /\b(recovering overdue|field visits|calling delinquent|bucket resolution|emi collection|overdue accounts|general ledger|balance sheet|tax returns|financial auditing|bank reconciliation)\b/i;

const DESIGN_RESPONSIBILITIES_PATTERN =
  /\b(photoshop|illustrator|figma|typography|visual assets|banners|creative design|wireframes|prototypes)\b/i;

/**
 * Classify a job listing into a primary career domain.
 * Evaluates job title and description evidence together, with stronger weight
 * for explicit technical responsibilities and required skills.
 *
 * @param {Object} job - Job document
 * @returns {string} One of CAREER_DOMAINS
 */
export const classifyJobDomain = (job) => {
  if (!job) return CAREER_DOMAINS.ALL;

  const title = (job.title || '').trim();
  const desc = (job.description || '').slice(0, 2000);
  const reqs = Array.isArray(job.requirements) ? job.requirements.join(' ') : '';
  const fullText = `${title} ${title} ${reqs} ${desc}`.toLowerCase();

  // 1. Explicit domain negative overrides (Highest signal)
  // Prevents non-tech roles with misleading tokens (e.g. Lending Collections (Frontend)) from matching tech.
  for (const { domain, pattern } of NON_TECH_OVERRIDE_PATTERNS) {
    if (pattern.test(title)) {
      return domain;
    }
  }

  // 2. Score title and description evidence together
  const scores = {
    tech: 0,
    data: 0,
    finance: 0,
    business: 0,
    marketing_hr: 0,
  };

  // Title Evidence: specific data/finance/marketing titles take precedence over generic engineering stem
  for (const { domain, pattern } of JOB_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      // Data, finance, and marketing titles get +12 to prevent generic 'engineer' or 'developer' from overriding
      scores[domain] += domain === 'tech' ? 10 : 12;
    }
  }

  // Description Explicit Responsibilities Evidence (+6)
  if (TECH_RESPONSIBILITIES_PATTERN.test(fullText)) scores.tech += 6;
  if (DATA_RESPONSIBILITIES_PATTERN.test(fullText)) scores.data += 6;
  if (FINANCE_RESPONSIBILITIES_PATTERN.test(fullText)) scores.finance += 6;
  if (DESIGN_RESPONSIBILITIES_PATTERN.test(fullText)) scores.marketing_hr += 6;

  // Description / Requirements Skills Evidence (+2 per verified skill)
  const words = fullText.split(/[\s,.;:()/-]+/);
  const seenTechSkills = new Set();
  const seenDataSkills = new Set();
  const seenFinanceSkills = new Set();
  const seenBusinessSkills = new Set();
  const seenMarketingSkills = new Set();

  for (const w of words) {
    if (TECH_SKILLS.has(w) && !seenTechSkills.has(w)) {
      seenTechSkills.add(w);
      scores.tech += 2;
    }
    if (DATA_SKILLS.has(w) && !seenDataSkills.has(w)) {
      if (w === 'ai' || w === 'ml') {
        scores.data += 1;
      } else {
        seenDataSkills.add(w);
        scores.data += 2;
      }
    }
    if (FINANCE_SKILLS.has(w) && !seenFinanceSkills.has(w)) {
      seenFinanceSkills.add(w);
      scores.finance += 2;
    }
    if (BUSINESS_SKILLS.has(w) && !seenBusinessSkills.has(w)) {
      seenBusinessSkills.add(w);
      scores.business += 2;
    }
    if (MARKETING_HR_SKILLS.has(w) && !seenMarketingSkills.has(w)) {
      seenMarketingSkills.add(w);
      scores.marketing_hr += 2;
    }
  }

  // Determine top domain with confidence threshold
  let bestDomain = CAREER_DOMAINS.ALL;
  let maxScore = 4; // requires at least one strong signal or title match

  for (const [dom, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestDomain = dom;
    }
  }

  return bestDomain;
};

/**
 * Analyze candidate profile and resume evidence to detect primary career domain.
 * Implements explainable scoring with skills, education, projects, and experience.
 *
 * Special rule: Non-technical degrees (B.Com, BBA) with demonstrated technical skills
 * (React, Node, Python, GitHub projects) are recognized for technical roles.
 *
 * @param {Object} profile - User's Profile document
 * @param {Object} [resume] - User's Resume document
 * @returns {Object} { domain, label, confidence, evidence, isAmbiguous }
 */
export const detectCandidateDomain = (profile, resume = null) => {
  const scores = {
    tech: 0,
    data: 0,
    finance: 0,
    business: 0,
    marketing_hr: 0,
  };

  const evidence = {
    skills: { tech: [], data: [], finance: [], business: [], marketing_hr: [] },
    educationSignals: [],
    experienceSignals: [],
    projectSignals: [],
  };

  if (!profile && !resume) {
    return {
      domain: CAREER_DOMAINS.ALL,
      label: DOMAIN_LABELS.all,
      confidence: 'low',
      evidence,
      isAmbiguous: true,
    };
  }

  // --- 1. Skills Scoring (Weight: 3 points per matching skill) ---
  const skillsList = Array.isArray(profile?.skills) ? profile.skills : [];
  for (const s of skillsList) {
    const clean = String(s).toLowerCase().trim();
    if (!clean) continue;

    if (TECH_SKILLS.has(clean)) {
      scores.tech += 3;
      evidence.skills.tech.push(s);
    }
    if (DATA_SKILLS.has(clean)) {
      scores.data += 3;
      evidence.skills.data.push(s);
    }
    if (FINANCE_SKILLS.has(clean)) {
      scores.finance += 3;
      evidence.skills.finance.push(s);
    }
    if (BUSINESS_SKILLS.has(clean)) {
      scores.business += 3;
      evidence.skills.business.push(s);
    }
    if (MARKETING_HR_SKILLS.has(clean)) {
      scores.marketing_hr += 3;
      evidence.skills.marketing_hr.push(s);
    }
  }

  // --- 2. Education Scoring (Weight: 5 points for relevant degree/field) ---
  const educationList = Array.isArray(profile?.education) ? profile.education : [];
  for (const edu of educationList) {
    const text = `${edu.degree || ''} ${edu.fieldOfStudy || ''}`.trim();
    if (!text) continue;

    for (const { domain, pattern } of DEGREE_PATTERNS) {
      if (pattern.test(text)) {
        scores[domain] += 5;
        evidence.educationSignals.push({ degree: text, domain });
      }
    }
  }

  // --- 3. Projects Scoring (Weight: 3 points for tech/data tools, 2 points for titles) ---
  const projectList = Array.isArray(profile?.projects) ? profile.projects : [];
  for (const proj of projectList) {
    const title = (proj.title || '').toLowerCase();
    const desc = (proj.description || '').toLowerCase();
    const techs = Array.isArray(proj.technologies) ? proj.technologies : [];

    // Technologies used
    for (const t of techs) {
      const clean = String(t).toLowerCase().trim();
      if (TECH_SKILLS.has(clean)) {
        scores.tech += 2;
        evidence.projectSignals.push(clean);
      }
      if (DATA_SKILLS.has(clean)) {
        scores.data += 2;
        evidence.projectSignals.push(clean);
      }
    }

    if (/\b(web|app|application|react|node|fullstack|frontend|backend|api|database|software)\b/i.test(`${title} ${desc}`)) {
      scores.tech += 2;
    }
    if (/\b(machine learning|model|prediction|dataset|analysis|dashboard|power bi|tableau)\b/i.test(`${title} ${desc}`)) {
      scores.data += 2;
    }
    if (/\b(financial|accounting|audit|tax|portfolio)\b/i.test(`${title} ${desc}`)) {
      scores.finance += 2;
    }
    if (/\b(business plan|market research|case study|operations|management)\b/i.test(`${title} ${desc}`)) {
      scores.business += 2;
    }
  }

  // --- 4. Experience Roles Scoring (Weight: 4 points for matching titles) ---
  const experienceList = Array.isArray(profile?.experience) ? profile.experience : [];
  for (const exp of experienceList) {
    const role = (exp.role || '').toLowerCase();
    if (!role) continue;

    for (const { domain, pattern } of JOB_TITLE_PATTERNS) {
      if (pattern.test(role)) {
        scores[domain] += 4;
        evidence.experienceSignals.push({ role, domain });
      }
    }

    const techs = Array.isArray(exp.technologies) ? exp.technologies : [];
    for (const t of techs) {
      const clean = String(t).toLowerCase().trim();
      if (TECH_SKILLS.has(clean)) scores.tech += 2;
      if (DATA_SKILLS.has(clean)) scores.data += 2;
      if (FINANCE_SKILLS.has(clean)) scores.finance += 2;
    }
  }

  // --- 5. Raw Resume Text Fallback (if profile is sparse) ---
  const rawResume = (resume?.parsed?.rawText || '').slice(0, 3000).toLowerCase();
  if (rawResume && Object.values(scores).every((v) => v === 0)) {
    for (const { domain, pattern } of DEGREE_PATTERNS) {
      if (pattern.test(rawResume)) scores[domain] += 3;
    }
    for (const { domain, pattern } of JOB_TITLE_PATTERNS) {
      if (pattern.test(rawResume)) scores[domain] += 2;
    }
  }

  // Calculate top domain
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topDomain, topScore] = entries[0];
  const secondScore = entries[1] ? entries[1][1] : 0;

  // Build explainable evidence summary
  let evidenceSummary = '';
  if (topScore < 3) {
    evidenceSummary = 'No strong domain-specific evidence detected. Displaying all domains.';
    return {
      domain: CAREER_DOMAINS.ALL,
      label: DOMAIN_LABELS.all,
      confidence: 'low',
      evidence,
      scores,
      evidenceSummary,
      isAmbiguous: true,
    };
  }

  const confidence = topScore >= 10 && topScore >= secondScore * 1.5 ? 'high' : 'medium';

  // Construct readable explanation
  const matchingSkills = evidence.skills[topDomain] || [];
  const matchingEdu = evidence.educationSignals.filter((e) => e.domain === topDomain);
  const parts = [];

  if (matchingEdu.length > 0) {
    parts.push(`education (${matchingEdu.map((e) => e.degree).join(', ')})`);
  }
  if (matchingSkills.length > 0) {
    parts.push(`skills (${matchingSkills.slice(0, 4).join(', ')})`);
  }
  if (evidence.projectSignals.length > 0 && topDomain === 'tech') {
    parts.push(`projects (${evidence.projectSignals.slice(0, 3).join(', ')})`);
  }

  evidenceSummary = parts.length > 0
    ? `Tailored to ${DOMAIN_LABELS[topDomain]} based on your ${parts.join(' and ')}.`
    : `Tailored to ${DOMAIN_LABELS[topDomain]} based on your profile evidence.`;

  return {
    domain: topDomain,
    label: DOMAIN_LABELS[topDomain] || 'All Domains',
    confidence,
    evidence,
    scores,
    evidenceSummary,
    isAmbiguous: false,
  };
};

/**
 * Determines whether a candidate is a student or fresher (early-career).
 * Used to prioritize internships, graduate, and entry-level positions appropriately.
 *
 * @param {Object} profile - User's Profile document
 * @returns {boolean}
 */
export const isCandidateStudentOrFresher = (profile) => {
  if (!profile) return true; // Default to student/fresher for safe entry-level prioritization

  const expList = Array.isArray(profile?.experience) ? profile.experience : [];
  if (expList.length === 0) return true;

  // Check if currently pursuing degree
  const eduList = Array.isArray(profile?.education) ? profile.education : [];
  if (eduList.some((e) => e.current === true)) {
    return true;
  }

  // Calculate estimated total non-internship work months
  let totalMonths = 0;
  for (const item of expList) {
    const role = (item.role || '').toLowerCase();
    // Internships, trainee, and apprenticeships don't count towards experienced status
    if (/\b(intern|internship|trainee|apprentice|student|fellow)\b/i.test(role)) {
      continue;
    }

    const start = item.startDate ? new Date(item.startDate) : null;
    const end = item.endDate ? new Date(item.endDate) : (item.current ? new Date() : null);

    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += Math.max(0, months);
    } else {
      totalMonths += 12; // default 1 year per listed role if dates missing
    }
  }

  return totalMonths <= 24; // 2 years or less is considered fresher / early career
};

export default {
  CAREER_DOMAINS,
  DOMAIN_LABELS,
  NON_TECH_OVERRIDE_PATTERNS,
  JOB_TITLE_PATTERNS,
  getDomainTitleRegex,
  classifyJobDomain,
  detectCandidateDomain,
  isCandidateStudentOrFresher,
};

