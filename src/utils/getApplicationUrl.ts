
export type ApplicationJob = {
  company_apply_url?: string | null;
  application_url_status?: string | null;
  source_job_url?: string | null;
  job_url?: string | null;
};

function isValidHttpUrl(
  value?: string | null
): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export function getApplicationUrl(
  job: ApplicationJob
) {
  const companyUrl =
    job.company_apply_url?.trim();

  if (
    job.application_url_status === "verified" &&
    isValidHttpUrl(companyUrl)
  ) {
    return {
      url: companyUrl!,
      label: "Apply on company website",
      destination: "company" as const,
    };
  }

  const sourceUrl =
    job.source_job_url?.trim() ||
    job.job_url?.trim();

  if (isValidHttpUrl(sourceUrl)) {
    return {
      url: sourceUrl!,
      label: "View job on Adzuna",
      destination: "source" as const,
    };
  }

  return {
    url: null,
    label: "Application link unavailable",
    destination: "none" as const,
  };
}
