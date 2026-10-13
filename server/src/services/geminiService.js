import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let genAIClient = null;

/**
 * Initialize or get Google GenAI client instance
 */
export const getGeminiClient = () => {
  const apiKey = env.GEMINI.API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error(
      'Gemini API key is not configured. Please set a valid GEMINI_API_KEY in server/.env'
    );
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }

  return genAIClient;
};

/**
 * Parse raw resume plaintext into structured JSON matching the Profile schema.
 * Uses Gemini models via official @google/genai SDK.
 *
 * @param {string} rawText - Extracted resume plaintext
 * @returns {Promise<Object>} Structured candidate JSON
 */
export const parseResumeWithGemini = async (rawText) => {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Valid resume text is required for Gemini parsing');
  }

  const ai = getGeminiClient();
  const primaryModel = env.GEMINI.MODEL || 'gemini-3.5-flash';
  const candidateModels = Array.from(new Set([
    primaryModel,
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
  ])).filter(Boolean);

  // Bound raw text to 15,000 characters to optimize token size while preserving all qualifications
  const boundedText = rawText.trim().slice(0, 15000);

  const systemInstruction = `You are an expert AI resume parsing engine.
Your sole job is to extract factual candidate details from the provided resume text into a strictly formatted JSON object matching the requested schema.

STRICT ACCURACY RULES:
1. Do NOT invent, assume, or extrapolate any qualifications, degrees, skills, or dates not explicitly written in the resume.
2. If any field or category is not mentioned or unknown, set it to "" (empty string), null, or [] (empty array).
3. Do not include markdown code blocks or explanations. Return ONLY valid, parseable JSON.
4. Normalize skills as a clean array of strings (e.g. ["JavaScript", "React", "Node.js"]).
5. Dates should follow ISO 8601 strings (YYYY-MM-DD or YYYY-MM) or YYYY if only year is present, or null if missing.`;

  const prompt = `Parse the following raw resume text into this exact JSON structure:
{
  "personal": {
    "name": "Candidate full name, or empty string",
    "email": "Email address, or empty string",
    "phone": "Phone number, or empty string",
    "location": "City, State/Country, or empty string",
    "portfolioUrl": "Personal website or portfolio URL, or empty string",
    "linkedinUrl": "LinkedIn profile URL, or empty string",
    "githubUrl": "GitHub profile URL, or empty string"
  },
  "summary": "Professional summary or objective text, or empty string",
  "skills": ["Skill 1", "Skill 2"],
  "education": [
    {
      "institution": "University / College / School name",
      "degree": "Degree title (e.g., Bachelor of Science)",
      "fieldOfStudy": "Major or field of study",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "current": false,
      "gpa": "GPA if explicitly mentioned, or empty string"
    }
  ],
  "experience": [
    {
      "company": "Company or organization name",
      "role": "Job title or role",
      "location": "Job location, or empty string",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "current": false,
      "highlights": ["Key responsibility or accomplishment bullet point"],
      "technologies": ["Technologies or tools explicitly used in this role"]
    }
  ],
  "projects": [
    {
      "title": "Project title",
      "description": "Project overview",
      "liveUrl": "Live demo URL, or empty string",
      "githubUrl": "Repository URL, or empty string",
      "technologies": ["Technology used"]
    }
  ],
  "certifications": [
    {
      "name": "Certification title",
      "issuer": "Issuing organization",
      "issueDate": "YYYY-MM-DD or null",
      "expiryDate": "YYYY-MM-DD or null",
      "credentialId": "Credential ID, or empty string",
      "url": "Certificate verification URL, or empty string"
    }
  ]
}

RESUME PLAINTEXT:
${boundedText}
`;

  let lastError = null;
  const CALL_TIMEOUT_MS = 10000;

  for (const modelName of candidateModels) {
    const callStart = Date.now();
    let timerId = null;

    try {
      logger.info(`Invoking Gemini (${modelName}) for resume parsing...`);

      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error(`Gemini request timeout after ${CALL_TIMEOUT_MS}ms for model ${modelName}`));
        }, CALL_TIMEOUT_MS);
      });

      const responsePromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);
      if (timerId) clearTimeout(timerId);

      const responseText = (response.text || '').trim();

      if (!responseText) {
        throw new Error('Gemini returned an empty response during resume parsing');
      }

      // Clean markdown code blocks and extract valid JSON boundary
      let cleanedJsonText = responseText.trim();
      if (cleanedJsonText.startsWith('```')) {
        cleanedJsonText = cleanedJsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      const firstBrace = cleanedJsonText.indexOf('{');
      const lastBrace = cleanedJsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedJsonText = cleanedJsonText.slice(firstBrace, lastBrace + 1);
      }

      // Parse JSON safely
      const parsedData = JSON.parse(cleanedJsonText);

      // Sanitize structure ensuring all top-level keys exist
      const sanitized = {
        personal: {
          name: parsedData.personal?.name || '',
          email: parsedData.personal?.email || '',
          phone: parsedData.personal?.phone || '',
          location: parsedData.personal?.location || '',
          portfolioUrl: parsedData.personal?.portfolioUrl || '',
          linkedinUrl: parsedData.personal?.linkedinUrl || '',
          githubUrl: parsedData.personal?.githubUrl || '',
        },
        summary: parsedData.summary || '',
        skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
        education: Array.isArray(parsedData.education) ? parsedData.education : [],
        experience: Array.isArray(parsedData.experience) ? parsedData.experience : [],
        projects: Array.isArray(parsedData.projects) ? parsedData.projects : [],
        certifications: Array.isArray(parsedData.certifications) ? parsedData.certifications : [],
      };

      const durationMs = Date.now() - callStart;
      logger.info(
        `Gemini parsing complete using ${modelName} in ${durationMs}ms: ${sanitized.skills.length} skills, ${sanitized.experience.length} experiences, ${sanitized.education.length} education entries extracted.`
      );

      return sanitized;
    } catch (error) {
      if (timerId) clearTimeout(timerId);
      lastError = error;
      const durationMs = Date.now() - callStart;
      logger.warn(`Gemini parsing attempt with model ${modelName} failed in ${durationMs}ms:`, error.message);
      // Continue to next candidate model if high demand (503), rate limit (429), or timeout
      const isRecoverable =
        error.message?.includes('503') ||
        error.message?.includes('429') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Timeout');

      if (!isRecoverable && candidateModels.indexOf(modelName) === candidateModels.length - 1) {
        break;
      }
    }
  }

  logger.error('All Gemini model parsing attempts failed:', lastError?.message);
  throw new Error(`Gemini AI parsing failed: ${lastError?.message}`);
};

export default {
  getGeminiClient,
  parseResumeWithGemini,
};
