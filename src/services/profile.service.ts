import { supabase } from "../lib/supabase";

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

export async function getCandidateProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveCandidateProfile(
  profile: any,
  resumeFile: File | null
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  let resumeFilePath: string | null = null;

  /*
   * Upload resume to Supabase Storage
   */
  if (resumeFile) {
    const safeFileName = resumeFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    resumeFilePath = `${user.id}/${crypto.randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(resumeFilePath, resumeFile, {
        contentType: resumeFile.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Resume upload failed: ${uploadError.message}`
      );
    }
  }

  const candidate = profile.candidate || {};

  const profileData = {
    user_id: user.id,

    name: candidate.name || null,
    email: candidate.email || null,
    phone: candidate.phone || null,
    location: candidate.location || null,

    linkedin: candidate.linkedin || null,
    github: candidate.github || null,
    portfolio: candidate.portfolio || null,

    summary: profile.summary || null,

    skills: profile.skills || [],
    experience: profile.experience || [],
    education: profile.education || [],
    projects: profile.projects || [],
    certifications: profile.certifications || [],
    languages: profile.languages || [],

    preferred_job_titles:
      profile.preferredJobTitles || [],

    inferred_keywords:
      profile.inferredKeywords || [],

    resume_file_name:
      resumeFile?.name || null,

    resume_file_path:
      resumeFilePath,

    resume_file_size:
      resumeFile?.size || null,

    profile_confirmed: true,

    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("candidate_profiles")
    .upsert(profileData, {
      onConflict: "user_id",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}