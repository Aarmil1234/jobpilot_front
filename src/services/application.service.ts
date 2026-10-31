import { supabase } from "../lib/supabase";

const API_URL = "http://localhost:5000";

export type PreparedAnswers = {
  professional_summary: string;
  relevant_experience: string;
  relevant_skills: string[];
  why_interested: string;
  missing_information: string[];
};

export type Application = {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  application_url: string | null;
  application_method: string | null;
  resume_file_path: string | null;
  cover_letter: string | null;
  prepared_answers: PreparedAnswers | null;
  approved_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  jobs?: {
    id?: string;
    title: string;
    company: string;
    location: string | null;
    job_url: string | null;
    company_apply_url?: string | null;
    application_url_status?: string | null;
  };
  application_answers?: Array<{
    id: string;
    field_key: string;
    field_label: string;
    answer: string;
    answer_source: string;
    is_verified: boolean;
  }>;
  application_events?: Array<{
    id: string;
    event_type: string;
    description: string;
    created_at: string;
  }>;
  application_consents?: Array<{
    id: string;
    consent_type: string;
    granted: boolean;
    granted_at: string | null;
    revoked_at: string | null;
  }>;
};

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export async function getApplications(): Promise<Application[]> {
  const data = await apiRequest("/api/applications");
  return data.applications as Application[];
}

export async function getApplicationById(
  applicationId: string
): Promise<Application> {
  const data = await apiRequest(
    `/api/applications/${encodeURIComponent(applicationId)}`
  );
  return data.application as Application;
}

export async function startApplicationPreparation(jobId: string) {
  let applicationId: string;

  try {
    const created = await apiRequest("/api/applications", {
      method: "POST",
      body: JSON.stringify({ jobId }),
    });

    applicationId = created.application.id;
  } catch (error) {
    if (!(error instanceof Error) ||
        !error.message.toLowerCase().includes("already have an application")) {
      throw error;
    }

    const applications = await getApplications();
    const existing = applications.find((item) => item.job_id === jobId);

    if (!existing) {
      throw error;
    }

    if (existing.status === "awaiting_approval" || existing.status === "approved") {
      return {
        success: true,
        message: "An application already exists for this job.",
        application: existing,
      };
    }

    applicationId = existing.id;
  }

  await apiRequest(`/api/applications/${applicationId}/consent`, {
    method: "POST",
    body: JSON.stringify({
      consentType: "prepare_application",
      granted: true,
      consentText:
        "I authorize JobPilot to use my confirmed candidate profile and the selected job details to prepare a tailored application.",
    }),
  });

  return apiRequest(`/api/applications/${applicationId}/prepare`, {
    method: "POST",
  });
}

export async function saveApplicationReview(
  applicationId: string,
  coverLetter: string,
  preparedAnswers: PreparedAnswers
): Promise<Application> {
  const data = await apiRequest(
    `/api/applications/${encodeURIComponent(applicationId)}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        coverLetter,
        preparedAnswers,
      }),
    }
  );

  return data.application as Application;
}

export async function approveApplication(
  applicationId: string
): Promise<Application> {
  const data = await apiRequest(
    `/api/applications/${encodeURIComponent(applicationId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    }
  );

  return data.application as Application;
}
