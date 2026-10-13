import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCompletionPercentage, getMyProfile } from '../src/services/profileService.js';
import Profile from '../src/models/Profile.js';

describe('Profile Completion Calculation - Canonical Weights (profileService.js)', () => {
  const baseFullProfile = {
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
        startDate: new Date('2021-03-01'),
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
        startDate: new Date('2014-09-01'),
        endDate: new Date('2018-05-01'),
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
        issueDate: new Date('2023-01-15'),
      },
    ],
  };

  test('returns 0% for null or undefined profile', () => {
    assert.equal(calculateCompletionPercentage(null), 0);
    assert.equal(calculateCompletionPercentage(undefined), 0);
    assert.equal(calculateCompletionPercentage({}), 0);
  });

  test('Case 1: Projects exist, certifications are empty -> overall completion must be 95%', () => {
    const profileWithoutCerts = {
      ...baseFullProfile,
      certifications: [], // Empty array
    };

    const completion = calculateCompletionPercentage(profileWithoutCerts);
    assert.equal(
      completion,
      95,
      `Expected 95% when certifications are empty but projects exist, got ${completion}%`
    );
  });

  test('Case 2: All seven sections are complete -> overall completion must be 100%', () => {
    const fullProfile = {
      ...baseFullProfile,
      certifications: [
        {
          name: 'AWS Certified Solutions Architect - Associate',
          issuer: 'Amazon Web Services',
          issueDate: new Date('2023-04-10'),
        },
      ],
    };

    const completion = calculateCompletionPercentage(fullProfile);
    assert.equal(
      completion,
      100,
      `Expected 100% when all 7 sections are complete, got ${completion}%`
    );
  });

  test('Requirement 5: Does not award certification points (5%) when certifications array is empty', () => {
    const emptyCertsProfile = {
      ...baseFullProfile,
      certifications: [],
    };
    const nullCertsProfile = {
      ...baseFullProfile,
      certifications: null,
    };

    assert.equal(calculateCompletionPercentage(emptyCertsProfile), 95);
    assert.equal(calculateCompletionPercentage(nullCertsProfile), 95);
  });

  test('Isolated 5% bucket: Projects empty, certifications populated -> 95%', () => {
    const profileWithoutProjects = {
      ...baseFullProfile,
      projects: [],
      certifications: [
        {
          name: 'CKA - Certified Kubernetes Administrator',
          issuer: 'Linux Foundation',
        },
      ],
    };

    const completion = calculateCompletionPercentage(profileWithoutProjects);
    assert.equal(
      completion,
      95,
      `Expected 95% when projects are empty but certifications exist, got ${completion}%`
    );
  });

  test('Both projects and certifications empty -> 90%', () => {
    const profileNoProjectsNoCerts = {
      ...baseFullProfile,
      projects: [],
      certifications: [],
    };

    const completion = calculateCompletionPercentage(profileNoProjectsNoCerts);
    assert.equal(
      completion,
      90,
      `Expected 90% when both projects and certifications are empty, got ${completion}%`
    );
  });

  test('Individual section weights sum precisely to 100%', () => {
    // 1. Only personal (20%)
    const onlyPersonal = { personal: baseFullProfile.personal };
    assert.equal(calculateCompletionPercentage(onlyPersonal), 20);

    // 2. Only summary (10%)
    const onlySummary = { summary: baseFullProfile.summary };
    assert.equal(calculateCompletionPercentage(onlySummary), 10);

    // 3. Only skills (20% for >=3 skills, 10% for <3 skills)
    const onlySkills3 = { skills: ['React', 'Node', 'TypeScript'] };
    assert.equal(calculateCompletionPercentage(onlySkills3), 20);
    const onlySkills2 = { skills: ['React', 'Node'] };
    assert.equal(calculateCompletionPercentage(onlySkills2), 10);

    // 4. Only experience (25%)
    const onlyExperience = { experience: baseFullProfile.experience };
    assert.equal(calculateCompletionPercentage(onlyExperience), 25);

    // 5. Only education (15%)
    const onlyEducation = { education: baseFullProfile.education };
    assert.equal(calculateCompletionPercentage(onlyEducation), 15);

    // 6. Only projects (5%)
    const onlyProjects = { projects: baseFullProfile.projects };
    assert.equal(calculateCompletionPercentage(onlyProjects), 5);

    // 7. Only certifications (5%)
    const onlyCertifications = { certifications: baseFullProfile.certifications };
    assert.equal(calculateCompletionPercentage(onlyCertifications), 5);

    // Sum: 20 + 10 + 20 + 25 + 15 + 5 + 5 = 100
    const sum = 20 + 10 + 20 + 25 + 15 + 5 + 5;
    assert.equal(sum, 100);
  });

  test('Personal information partial scoring awards 5% per distinct check (up to 20%)', () => {
    // 0 checks: empty personal object -> 0%
    assert.equal(calculateCompletionPercentage({ personal: {} }), 0);

    // 1 check: name only -> 5%
    assert.equal(calculateCompletionPercentage({ personal: { name: 'Alex' } }), 5);

    // 2 checks: name + email -> 10%
    assert.equal(
      calculateCompletionPercentage({ personal: { name: 'Alex', email: 'alex@example.com' } }),
      10
    );

    // 3 checks: name + email + phone (missing location/links) -> 15%
    assert.equal(
      calculateCompletionPercentage({
        personal: { name: 'Alex', email: 'alex@example.com', phone: '+1-555-0100' },
      }),
      15
    );

    // 3 checks: name + email + location (missing phone) -> 15%
    assert.equal(
      calculateCompletionPercentage({
        personal: { name: 'Alex', email: 'alex@example.com', location: 'Bengaluru' },
      }),
      15
    );

    // 4 checks: name + email + phone + linkedinUrl -> 20%
    assert.equal(
      calculateCompletionPercentage({
        personal: {
          name: 'Alex',
          email: 'alex@example.com',
          phone: '+1-555-0100',
          linkedinUrl: 'https://linkedin.com/in/alex',
        },
      }),
      20
    );
  });

  test('Overall profile completion is 95% when 3 personal checks are filled and all other 6 sections are completed', () => {
    const profile95 = {
      ...baseFullProfile,
      personal: {
        name: 'Alex Chen',
        email: 'alex.chen@example.com',
        phone: '', // missing phone check
        location: 'San Francisco, CA',
      },
    };

    // 15% (personal) + 10% (summary) + 20% (skills) + 25% (experience) + 15% (education) + 5% (projects) + 5% (certifications) = 95%
    const score = calculateCompletionPercentage(profile95);
    assert.equal(score, 95);
  });

  test('Overall profile completion is 100% when all 4 personal checks and all other 6 sections are completed', () => {
    const score = calculateCompletionPercentage(baseFullProfile);
    assert.equal(score, 100);
  });

  test('getMyProfile automatically synchronizes stale completion percentage to canonical value and calls save()', async () => {
    let saved = false;
    const fakeDoc = {
      ...baseFullProfile,
      certifications: [],
      completionPercentage: 100, // Stale legacy score
      save: async function () {
        saved = true;
        return this;
      },
    };

    const originalFindOne = Profile.findOne;
    Profile.findOne = async () => fakeDoc;

    try {
      const result = await getMyProfile('fake-user-id');
      assert.equal(result.completionPercentage, 95);
      assert.equal(saved, true);
    } finally {
      Profile.findOne = originalFindOne;
    }
  });

  test('getMyProfile does not call save() if completion percentage is already synchronized', async () => {
    let saved = false;
    const fakeDoc = {
      ...baseFullProfile,
      certifications: [],
      completionPercentage: 95, // Already canonical
      save: async function () {
        saved = true;
        return this;
      },
    };

    const originalFindOne = Profile.findOne;
    Profile.findOne = async () => fakeDoc;

    try {
      const result = await getMyProfile('fake-user-id');
      assert.equal(result.completionPercentage, 95);
      assert.equal(saved, false);
    } finally {
      Profile.findOne = originalFindOne;
    }
  });
});
