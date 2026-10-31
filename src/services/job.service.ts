import { supabase } from "../lib/supabase";

export type Job = {
  id: string;
  source: string;
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

  posted_at: string | null;

  is_active: boolean;

  created_at: string;
  updated_at: string;
};

export async function getJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("posted_at", {
      ascending: false,
      nullsFirst: false,
    });

  if (error) {
    throw error;
  }

  return (data || []) as Job[];
}