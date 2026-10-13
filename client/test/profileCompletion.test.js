import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfileCompletion, calculateSectionCompletion } from '../src/utils/helpers.js';

describe('Frontend Profile Completion Calculation - Canonical Weights (helpers.js)', () => {
  const baseProfile = {
    personal: {
      name: 'Alex Chen',
      email: 'alex.chen@example.com',
      phone: '+1 (555) 019-2834',
      location: 'San Francisco, CA',
      linkedinUrl: 'https://linkedin.com/in/alexchen',
      githubUrl: 'https://github.com/alexchen',
    },
    summary: 'Senior Full Stack Software Engineer with 6+ years of building scalable cloud platforms and web applications.',
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express',
      'MongoDB', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL'
    ],
    experience: [
      {
        company: 'Stripe',
        role: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2021-03-01',
        current: true,
        highlights: ['Architected payment processing services handling 50k req/sec.'],
        technologies: ['Node.js', 'TypeScript', 'Docker'],
      },
    ],
    education: [
      {
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2014-09-01',
        endDate: '2018-05-01',
      },
    ],
    projects: [
      {
        title: 'Distributed Job Scheduler',
        description: 'Fault-tolerant background task orchestration engine.',
        liveUrl: 'https://scheduler.example.com',
        githubUrl: 'https://github.com/alexchen/scheduler',
        technologies: ['Go', 'Redis', 'Docker'],
      },
      {
        title: 'AI Resume Parser',
        description: 'Semantic extraction pipeline for unstructured CVs.',
        technologies: ['Python', 'Gemini AI'],
      },
    ],
    certifications: [
      {
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        issueDate: '2023-01-15',
      },
    ],
  };

  test('returns 0% for null or undefined profile', () => {
    assert.equal(calculateProfileCompletion(null), 0);
    assert.equal(calculateProfileCompletion(undefined), 0);
    assert.equal(calculateProfileCompletion({}), 0);
  });

  test('Case 1: Projects exist, certifications are empty -> overall completion must be 95%', () => {
    const profileWithoutCerts = {
      ...baseProfile,
      certifications: [], // Empty array
    };

    const completion = calculateProfileCompletion(profileWithoutCerts);
    assert.equal(
      completion,
      95,
      `Expected 95% when certifications are empty but projects exist, got ${completion}%`
    );
  });

  test('Case 2: All seven sections are complete -> overall completion must be 100%', () => {
    const fullProfile = {
      ...baseProfile,
      certifications: [
        {
          name: 'AWS Certified Solutions Architect - Associate',
          issuer: 'Amazon Web Services',
          issueDate: '2023-04-10',
        },
      ],
    };

    const completion = calculateProfileCompletion(fullProfile);
    assert.equal(
      completion,
      100,
      `Expected 100% when all 7 sections are complete, got ${completion}%`
    );
  });

  test('Requirement 5: Does not mark certifications as complete when certifications array is empty', () => {
    const emptyCertsProfile = {
      ...baseProfile,
      certifications: [],
    };
    const nullCertsProfile = {
      ...baseProfile,
      certifications: null,
    };

    assert.equal(calculateProfileCompletion(emptyCertsProfile), 95);
    assert.equal(calculateProfileCompletion(nullCertsProfile), 95);
  });

  test('Isolated 5% bucket: Projects empty, certifications populated -> 95%', () => {
    const profileWithoutProjects = {
      ...baseProfile,
      projects: [],
      certifications: [
        {
          name: 'CKA - Certified Kubernetes Administrator',
          issuer: 'Linux Foundation',
        },
      ],
    };

    const completion = calculateProfileCompletion(profileWithoutProjects);
    assert.equal(
      completion,
      95,
      `Expected 95% when projects are empty but certifications exist, got ${completion}%`
    );
  });

  test('Both projects and certifications empty -> 90%', () => {
    const profileNoProjectsNoCerts = {
      ...baseProfile,
      projects: [],
      certifications: [],
    };

    const completion = calculateProfileCompletion(profileNoProjectsNoCerts);
    assert.equal(
      completion,
      90,
      `Expected 90% when both projects and certifications are empty, got ${completion}%`
    );
  });

  test('Matches canonical weights across all sections (20 + 10 + 20 + 25 + 15 + 5 + 5 = 100)', () => {
    assert.equal(calculateProfileCompletion({ personal: baseProfile.personal }), 20);
    assert.equal(calculateProfileCompletion({ summary: baseProfile.summary }), 10);
    assert.equal(calculateProfileCompletion({ skills: ['React', 'Node', 'TypeScript'] }), 20);
    assert.equal(calculateProfileCompletion({ skills: ['React', 'Node'] }), 10);
    assert.equal(calculateProfileCompletion({ experience: baseProfile.experience }), 25);
    assert.equal(calculateProfileCompletion({ education: baseProfile.education }), 15);
    assert.equal(calculateProfileCompletion({ projects: baseProfile.projects }), 5);
    assert.equal(calculateProfileCompletion({ certifications: baseProfile.certifications }), 5);
  });
});

describe('Frontend Section Breakdown Calculation - calculateSectionCompletion (helpers.js)', () => {
  const fullProfile = {
    personal: {
      name: 'Alex Chen',
      email: 'alex.chen@example.com',
      phone: '+1 (555) 019-2834',
      location: 'San Francisco, CA',
      linkedinUrl: 'https://linkedin.com/in/alexchen',
      githubUrl: 'https://github.com/alexchen',
    },
    summary: 'Senior Full Stack Software Engineer with 6+ years of building scalable cloud platforms and web applications.',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    experience: [{ company: 'Stripe', role: 'Engineer' }],
    education: [{ institution: 'UC Berkeley', degree: 'BS' }],
    projects: [{ title: 'Scheduler' }],
    certifications: [{ name: 'AWS Solutions Architect' }],
  };

  test('returns 0% and isComplete false for empty or null profile', () => {
    const res = calculateSectionCompletion(null);
    assert.equal(res.personal.percentage, 0);
    assert.equal(res.personal.isComplete, false);
    assert.equal(res.summary.percentage, 0);
    assert.equal(res.skills.percentage, 0);
    assert.equal(res.experience.percentage, 0);
    assert.equal(res.education.percentage, 0);
    assert.equal(res.projects.percentage, 0);
    assert.equal(res.certifications.percentage, 0);
  });

  test('Personal Information partial percentages: 4 checks worth 25% each', () => {
    // 1 check: name only -> 25%
    const oneCheck = calculateSectionCompletion({ personal: { name: 'Alex' } });
    assert.equal(oneCheck.personal.percentage, 25);
    assert.equal(oneCheck.personal.isComplete, false);
    assert.equal(oneCheck.personal.passedCount, 1);

    // 2 checks: name + email -> 50%
    const twoChecks = calculateSectionCompletion({
      personal: { name: 'Alex', email: 'alex@example.com' },
    });
    assert.equal(twoChecks.personal.percentage, 50);
    assert.equal(twoChecks.personal.isComplete, false);
    assert.equal(twoChecks.personal.passedCount, 2);

    // 3 checks: name + email + phone (missing location/links) -> 75%
    const threeChecksA = calculateSectionCompletion({
      personal: { name: 'Alex', email: 'alex@example.com', phone: '1234567890' },
    });
    assert.equal(threeChecksA.personal.percentage, 75);
    assert.equal(threeChecksA.personal.isComplete, false);
    assert.equal(threeChecksA.personal.passedCount, 3);

    // 3 checks: name + email + location (missing phone) -> 75%
    const threeChecksB = calculateSectionCompletion({
      personal: { name: 'Alex', email: 'alex@example.com', location: 'Bengaluru' },
    });
    assert.equal(threeChecksB.personal.percentage, 75);
    assert.equal(threeChecksB.personal.isComplete, false);
    assert.equal(threeChecksB.personal.passedCount, 3);

    // 4 checks: name + email + phone + linkedinUrl -> 100%
    const fourChecks = calculateSectionCompletion({
      personal: {
        name: 'Alex',
        email: 'alex@example.com',
        phone: '1234567890',
        linkedinUrl: 'https://linkedin.com/in/alex',
      },
    });
    assert.equal(fourChecks.personal.percentage, 100);
    assert.equal(fourChecks.personal.isComplete, true);
    assert.equal(fourChecks.personal.passedCount, 4);
  });

  test('Skills partial percentage: >=3 is 100%, 1-2 is 50%, 0 is 0%', () => {
    assert.equal(calculateSectionCompletion({ skills: [] }).skills.percentage, 0);
    assert.equal(calculateSectionCompletion({ skills: [] }).skills.isComplete, false);

    const oneSkill = calculateSectionCompletion({ skills: ['React'] });
    assert.equal(oneSkill.skills.percentage, 50);
    assert.equal(oneSkill.skills.isComplete, false);

    const twoSkills = calculateSectionCompletion({ skills: ['React', 'Node.js'] });
    assert.equal(twoSkills.skills.percentage, 50);
    assert.equal(twoSkills.skills.isComplete, false);

    const threeSkills = calculateSectionCompletion({ skills: ['React', 'Node.js', 'TypeScript'] });
    assert.equal(threeSkills.skills.percentage, 100);
    assert.equal(threeSkills.skills.isComplete, true);
  });

  test('Bug Repro: When overall completion is 95% due to 3/4 personal info checks, checklist shows 75% for Personal Info instead of 100%', () => {
    const profile95 = {
      ...fullProfile,
      personal: {
        name: 'Alex Chen',
        email: 'alex.chen@example.com',
        phone: '', // missing phone
        location: 'San Francisco, CA',
      },
    };

    const overallScore = calculateProfileCompletion(profile95);
    const sections = calculateSectionCompletion(profile95);

    // Backend/canonical overall score is 95% (15 personal + 10 summary + 20 skills + 25 exp + 15 edu + 5 proj + 5 cert = 95%)
    assert.equal(overallScore, 95);

    // Personal section correctly shows 75% (3 of 4 checks), resolving the inconsistency where it previously showed 100%
    assert.equal(sections.personal.percentage, 75);
    assert.equal(sections.personal.isComplete, false);

    // Other completed sections show 100%
    assert.equal(sections.summary.percentage, 100);
    assert.equal(sections.skills.percentage, 100);
    assert.equal(sections.experience.percentage, 100);
    assert.equal(sections.education.percentage, 100);
    assert.equal(sections.projects.percentage, 100);
    assert.equal(sections.certifications.percentage, 100);
  });

  test('Fully completed profile: overall is 100% and all 7 sections show 100% with isComplete true', () => {
    const overallScore = calculateProfileCompletion(fullProfile);
    const sections = calculateSectionCompletion(fullProfile);

    assert.equal(overallScore, 100);
    assert.equal(sections.personal.percentage, 100);
    assert.equal(sections.personal.isComplete, true);
    assert.equal(sections.summary.percentage, 100);
    assert.equal(sections.summary.isComplete, true);
    assert.equal(sections.skills.percentage, 100);
    assert.equal(sections.skills.isComplete, true);
    assert.equal(sections.experience.percentage, 100);
    assert.equal(sections.experience.isComplete, true);
    assert.equal(sections.education.percentage, 100);
    assert.equal(sections.education.isComplete, true);
    assert.equal(sections.projects.percentage, 100);
    assert.equal(sections.projects.isComplete, true);
    assert.equal(sections.certifications.percentage, 100);
    assert.equal(sections.certifications.isComplete, true);
  });

  describe('Profile Save Payload Normalization', () => {
    test('normalizes experience with "Present" or "current" to current: true and endDate: null', () => {
      const expList = [
        { role: 'Dev', company: 'Corp', startDate: 'Jan 2024', endDate: 'Present', current: false },
        { role: 'Intern', company: 'Old Corp', startDate: '2022', endDate: '2023', current: false },
      ];

      const normalized = expList.map((exp) => {
        const isPresent =
          typeof exp.endDate === 'string' &&
          /^(present|current|ongoing|now)$/i.test(exp.endDate.trim());
        return {
          ...exp,
          current: Boolean(exp.current || isPresent),
          endDate: isPresent ? null : (exp.endDate || null),
        };
      });

      assert.equal(normalized[0].current, true);
      assert.equal(normalized[0].endDate, null);
      assert.equal(normalized[1].current, false);
      assert.equal(normalized[1].endDate, '2023');
    });

    test('normalizes education with "Present" to current: true and endDate: null', () => {
      const eduList = [
        { institution: 'Uni', degree: 'BS', startDate: '2023', endDate: 'Present', current: false },
        { institution: 'School', degree: 'High School', startDate: '2019', endDate: '2023', current: false },
      ];

      const normalized = eduList.map((edu) => {
        const isPresent =
          typeof edu.endDate === 'string' &&
          /^(present|current|ongoing|now)$/i.test(edu.endDate.trim());
        return {
          ...edu,
          current: Boolean(edu.current || isPresent),
          endDate: isPresent ? null : (edu.endDate || null),
        };
      });

      assert.equal(normalized[0].current, true);
      assert.equal(normalized[0].endDate, null);
      assert.equal(normalized[1].current, false);
      assert.equal(normalized[1].endDate, '2023');
    });
  });
});

