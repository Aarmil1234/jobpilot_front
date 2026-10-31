import type { Job } from "./job.service";

type CandidateProfile = {
  candidate: {
    location: string;
  };

  skills: string[];

  experience: {
    role: string;
    technologies: string[];
    description: string;
  }[];

  preferredJobTitles: string[];

  inferredKeywords: string[];
};

export type JobMatch = Job & {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchReason: string;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w+#.-]/g, " ");

const unique = (items: string[]) =>
  [...new Set(items.map((x) => x.trim()))];

export function calculateJobMatch(
  job: Job,
  profile: CandidateProfile
): JobMatch {
  const candidateSkills = unique([
    ...profile.skills,

    ...profile.experience.flatMap(
      (experience) =>
        experience.technologies || []
    ),

    ...profile.inferredKeywords,
  ]).map(normalize);

  const jobSkills = unique([
    ...(job.skills || []),
    ...(job.requirements || []),
  ]).map(normalize);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  jobSkills.forEach((jobSkill) => {
    const matched = candidateSkills.some(
      (candidateSkill) =>
        candidateSkill === jobSkill ||
        candidateSkill.includes(jobSkill) ||
        jobSkill.includes(candidateSkill)
    );

    if (matched) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  });

  const skillScore =
    jobSkills.length > 0
      ? (matchedSkills.length /
          jobSkills.length) *
        60
      : 0;

  /* -------------------------
     JOB TITLE MATCH
  ------------------------- */

  const normalizedJobTitle =
    normalize(job.title);

  const titleMatch =
    profile.preferredJobTitles.some(
      (title) => {
        const normalizedTitle =
          normalize(title);

        return (
          normalizedJobTitle.includes(
            normalizedTitle
          ) ||
          normalizedTitle.includes(
            normalizedJobTitle
          )
        );
      }
    );

  const titleScore = titleMatch ? 20 : 0;

  /* -------------------------
     KEYWORD MATCH
  ------------------------- */

  const keywordMatches =
    profile.inferredKeywords.filter(
      (keyword) =>
        normalizedJobTitle.includes(
          normalize(keyword)
        ) ||
        normalize(
          job.description
        ).includes(
          normalize(keyword)
        )
    );

  const keywordScore = Math.min(
    keywordMatches.length * 3,
    10
  );

  /* -------------------------
     LOCATION
  ------------------------- */

  const candidateLocation =
    normalize(
      profile.candidate.location || ""
    );

  const jobLocation =
    normalize(
      job.location || ""
    );

  const locationMatch =
    job.remote ||
    !candidateLocation ||
    !jobLocation
      ? true
      : jobLocation.includes(
          candidateLocation
        ) ||
        candidateLocation.includes(
          jobLocation
        );

  const locationScore =
    locationMatch ? 10 : 0;

  /* -------------------------
     FINAL SCORE
  ------------------------- */

  const score = Math.min(
    100,
    Math.round(
      skillScore +
        titleScore +
        keywordScore +
        locationScore
    )
  );

  let matchReason =
    "This job matches your profile.";

  if (matchedSkills.length > 0) {
    matchReason =
      `Your profile matches ${matchedSkills.length} of ${jobSkills.length} listed skills.`;
  }

  if (
    titleMatch &&
    matchedSkills.length > 0
  ) {
    matchReason =
      "Your preferred role and skills align with this position.";
  }

  return {
    ...job,

    matchScore: score,

    matchedSkills,

    missingSkills,

    matchReason,
  };
}

export function matchJobs(
  jobs: Job[],
  profile: CandidateProfile
) {
  return jobs
    .map((job) =>
      calculateJobMatch(
        job,
        profile
      )
    )
    .sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );
}