import { supabase } from "../lib/supabase";

const API_URL = "http://localhost:5000";


export type JobMatch = {
  id: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  match_reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  jobs: {
    id: string;
    source: string;
    source_name: string | null;
    external_job_id: string | null;
    title: string;
    company: string;
    location: string | null;
    remote: boolean;
    salary: string | null;
    description: string;
    requirements: string[];
    skills: string[];
    job_url: string | null;
    source_job_url: string | null;
    company_apply_url: string | null;
    application_url_status:
      | "not_found"
      | "pending"
      | "verified"
      | "invalid"
      | null;
    application_url_checked_at: string | null;
    application_url_source: string | null;
    application_url_evidence:
      | Record<string, unknown>
      | null;
    posted_at: string | null;
    link_status: string | null;
    link_checked_at: string | null;
    relevance_score: number;
    relevance_label: string;
  };
};


export async function refreshCandidateMatches() {
  const {
    data: {
      user,
    },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      "User is not authenticated."
    );
  }

  const response = await fetch(
    `${API_URL}/api/jobs/match/${user.id}`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Failed to generate job matches."
    );
  }

  return data;
}

export async function getCandidateMatches() {
  const {
    data: {
      user,
    },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      "User is not authenticated."
    );
  }

  const response = await fetch(
    `${API_URL}/api/jobs/matches/${user.id}`
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Failed to load job matches."
    );
  }

  return data.matches as JobMatch[];
}