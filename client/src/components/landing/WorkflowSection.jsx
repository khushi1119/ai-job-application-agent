import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Brain,
  FileEdit,
  Globe,
  Database,
  ArrowRight,
  CheckCircle2,
  Code2,
  Terminal,
  Activity,
  Cpu,
} from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';

export const WorkflowSection = () => {
  const [activeStep, setActiveStep] = useState(0);

  const workflowSteps = [
    {
      id: 'discovery',
      number: '01',
      title: 'Target Discovery & Normalization',
      shortTitle: 'Discovery & Scraping',
      icon: Search,
      badge: 'Scraper Engine',
      description:
        'The agent polls sample engineering career portals and applicant tracking systems (Greenhouse, Lever, Ashby, Workday). Job listings are parsed, deduplicated, and normalized into structured JSON specifications for pipeline processing.',
      input: 'Public Career Boards & ATS Endpoints',
      output: 'Normalized Job Document (Title, Stack, Level, Requirements)',
      agentThought: 'Identified 48 open roles for "Senior Fullstack Engineer". Filtering out duplicate postings and outdated roles (published > 14 days ago). 32 candidate roles queued for semantic scoring.',
      codeSnippet: `// Step 1: Normalized Payload (Sample Spec)\n{\n  "company": "Acme Corp (Demo)",\n  "role": "Staff Frontend Engineer",\n  "ats": "greenhouse",\n  "remote": true,\n  "techStack": ["React", "TypeScript", "Node.js"]\n}`,
    },
    {
      id: 'reasoning',
      number: '02',
      title: 'Semantic Fit & Scoring',
      shortTitle: 'Semantic Evaluation',
      icon: Brain,
      badge: 'LLM Reasoning',
      description:
        'The reasoning engine performs multi-dimensional vector matching between the candidate’s master profile graph and the target job description. It computes a match score and determines whether criteria thresholds are met.',
      input: 'User Skill Graph + Job Description Requirements',
      output: 'Score: 96% Match • Qualification Highlights & Gap Analysis',
      agentThought: 'Candidate has 6 years React & TypeScript experience. Strong architectural background matches the role’s technical scope. Hard salary and location requirements are satisfied. Match confidence: 96%.',
      codeSnippet: `// Step 2: Scoring Vector (Simulated Result)\n{\n  "overallMatch": 0.96,\n  "skillsMatch": 0.98,\n  "seniorityAlignment": 0.94,\n  "recommendation": "PROCEED_TO_TAILORING"\n}`,
    },
    {
      id: 'tailoring',
      number: '03',
      title: 'Contextual Tailoring & Q&A Synthesis',
      shortTitle: 'Answer Synthesis',
      icon: FileEdit,
      badge: 'AI Synthesis',
      description:
        'The agent tailors specific resume emphasis areas to highlight relevant achievements and generates high-conviction, personalized answers for employer screening questions based strictly on verified background data.',
      input: 'Match Analysis + Custom Employer Screening Prompts',
      output: 'Tailored Resume PDF + Form Response Data',
      agentThought: 'Synthesized responses for 4 custom questions: verified against past achievements. Formatted customized resume highlighting distributed systems and micro-frontends.',
      codeSnippet: `// Step 3: Screening Responses (Sample Synthesis)\n{\n  "whyInterested": "Proven track record in scaling fintech UIs...",\n  "yearsExperienceReact": 6,\n  "authorizedToWork": true\n}`,
    },
    {
      id: 'browser',
      number: '04',
      title: 'Headless Cloud Browser Dispatch',
      shortTitle: 'Browser Automation',
      icon: Globe,
      badge: 'Cloud Browser',
      description:
        'A dedicated headless browser instance opens the application portal. The agent identifies form fields (including nested modals, custom dropdowns, and file upload dropzones) and populates them automatically.',
      input: 'Application URL + Synthesized Form Payload',
      output: 'Interactive Form Completion & File Attachment',
      agentThought: 'Dispatched simulated cloud browser session. Identified 16 form fields across 2 steps. Attached customized resume PDF. Handled custom select dropdowns. Validated all required fields prior to submission.',
      codeSnippet: `// Step 4: Browser Action Log (Simulated Test)\n{\n  "portal": "https://boards.greenhouse.io/sample-tech/jobs/demo-101",\n  "status": "FORM_FILLED_VERIFIED",\n  "attachments": ["resume_staff_fe.pdf"]\n}`,
    },
    {
      id: 'verification',
      number: '05',
      title: 'Submission Proof & Audit Telemetry',
      shortTitle: 'Audit & Telemetry',
      icon: Database,
      badge: 'Telemetry & Proof',
      description:
        'The agent triggers final submission simulation, captures screenshot proof of the confirmation state, generates an audit token, and logs complete application records into your centralized dashboard database.',
      input: 'Submitted Portal State',
      output: 'Confirmation ID + Submission Screenshot + Real-time Dashboard Update',
      agentThought: '[Simulated Execution] Validation complete. Simulated submission token: #SIM-89241 generated. Audit trace stored for dashboard testing.',
      codeSnippet: `// Step 5: Submission Record (Simulation Trace)\n{\n  "confirmationId": "SIM-89241",\n  "status": "SIMULATED_SUCCESS",\n  "timestamp": "2026-09-24T10:15:05Z",\n  "proofUrl": "s3://proofs/sample-receipt.png"\n}`,
    },
  ];

  const current = workflowSteps[activeStep];

  return (
    <section id="workflow" className="py-20 md:py-28 relative scroll-mt-20">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-neon-lime/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-lime-bg border border-neon-lime-border text-neon-lime text-xs font-semibold uppercase tracking-wider mb-4">
            <Cpu className="w-3.5 h-3.5 text-neon-lime" />
            <span>Architecture & Simulation Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            The Autonomous Agent Workflow
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            Observe the five continuous execution phases that illustrate how target roles move from discovery to verified submission in our planned architecture.
          </p>
        </div>

        {/* Step Selector Pills / Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {workflowSteps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                  isActive
                    ? 'bg-neon-lime text-black border-neon-lime shadow-glow-lime-sm font-bold scale-105'
                    : 'bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border-dark-border'
                }`}
              >
                <span className={`font-mono text-xs ${isActive ? 'text-black font-extrabold' : 'text-neon-lime'}`}>
                  {step.number}
                </span>
                <span className="hidden sm:inline">{step.shortTitle}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Detailed Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-2xl border border-dark-border overflow-hidden shadow-2xl"
          >
            {/* Stage Header Bar */}
            <div className="p-6 bg-dark-900/90 border-b border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-neon-lime-bg border border-neon-lime-border flex items-center justify-center text-neon-lime shrink-0">
                  <current.icon className="w-6 h-6 text-neon-lime" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neon-lime font-bold">Phase {current.number}</span>
                    <Badge variant="lime" size="sm">{current.badge}</Badge>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                    {current.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Activity className="w-3.5 h-3.5 text-neon-lime animate-pulse" />
                <span>Deterministic Execution Trace</span>
              </div>
            </div>

            {/* 2-Column Content: Details & Code/Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              {/* Left Column: Description & Specifications */}
              <div className="lg:col-span-6 p-6 sm:p-8 bg-dark-950/60 border-b lg:border-b-0 lg:border-r border-dark-border flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Phase Overview
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    {current.description}
                  </p>

                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-dark-850/80 border border-dark-border">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Input Vector
                      </span>
                      <span className="text-xs font-medium text-white flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-neon-lime shrink-0" />
                        {current.input}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-dark-850/80 border border-dark-border">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Phase Output
                      </span>
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime shrink-0" />
                        {current.output}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Agent Thought Box */}
                <div className="mt-6 pt-4 border-t border-dark-border">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                    <Terminal className="w-3.5 h-3.5 text-neon-lime" />
                    <span>Agent Internal Log (Demo Simulation)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-dark-900 border border-dark-border font-mono text-xs text-slate-300 italic">
                    "{current.agentThought}"
                  </div>
                </div>
              </div>

              {/* Right Column: Code Payload / Terminal view */}
              <div className="lg:col-span-6 p-6 sm:p-8 bg-dark-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-mono text-slate-400 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-neon-lime" />
                      Payload Schema &bull; Execution Trace
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Sample JSON</span>
                  </div>

                  <div className="p-4 rounded-xl bg-dark-950 border border-dark-border font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
                    <pre className="text-slate-300">
                      <code>{current.codeSnippet}</code>
                    </pre>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-dark-border/80 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Step {current.number} of 05 in the pipeline cycle
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep((activeStep + 1) % workflowSteps.length)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neon-lime hover:text-white transition-colors"
                  >
                    <span>Next Phase</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default WorkflowSection;
