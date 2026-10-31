import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  refreshCandidateMatches,
  getCandidateMatches,
  type JobMatch,
} from "./services/job.matching.service";

import {
  UploadCloud,
  Sparkles,
  FileText,
  BriefcaseBusiness,
  CheckCircle2,
  UserRound,
  ChevronRight,
  ExternalLink,
  X,
  LogOut,
  Loader2,
} from "lucide-react";

import { supabase } from "./lib/supabase";
import { getApplicationUrl } from "./utils/getApplicationUrl";

import {
  getCandidateProfile,
  saveCandidateProfile,
} from "./services/profile.service";

import Auth from "./Auth";
import {
  getApplications,
  startApplicationPreparation,
  type Application,
} from "./services/application.service";

import "./styles.css";


const API_URL = "http://localhost:5000";

/* =========================================================
   TYPES
========================================================= */

type Page =
  | "resume"
  | "jobs"
  | "applications";

type Candidate = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
};

type Experience = {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
};

type Education = {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  grade?: string;
};

type Project = {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
};

type Certification =
  | string
  | {
      name: string;
      issuer?: string;
      date?: string;
      credentialId?: string;
    };

type Profile = {
  candidate: Candidate;

  summary: string;

  skills: string[];

  experience: Experience[];

  education: Education[];

  projects: Project[];

  certifications: Certification[];

  languages: string[];

  preferredJobTitles: string[];

  inferredKeywords: string[];
};

/* =========================================================
   APP
========================================================= */

export default function App() {
  const inputRef =
    useRef<HTMLInputElement>(null);

  /* -------------------------
     AUTH
  ------------------------- */

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);

  /* -------------------------
     APP STATE
  ------------------------- */

  const [page, setPage] =
    useState<Page>("resume");

  const [file, setFile] =
    useState<File | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [profileConfirmed, setProfileConfirmed] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [loadingProfile, setLoadingProfile] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =========================================================
     AUTH CHECK
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        setAuthenticated(!!user);

        if (user) {
          await loadSavedProfile();
        }
      } catch (err) {
        console.error(
          "Authentication check failed:",
          err
        );

        if (mounted) {
          setAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    checkAuth();

    /*
     * Listen for login/logout changes
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const isLoggedIn = !!session?.user;

        setAuthenticated(isLoggedIn);

        if (!isLoggedIn) {
          setProfile(null);
          setProfileConfirmed(false);
          setFile(null);
          setPage("resume");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     LOAD SAVED PROFILE
  ========================================================= */

  const loadSavedProfile = async () => {
    try {
      setLoadingProfile(true);

      const saved =
        await getCandidateProfile();

      if (!saved) {
        return;
      }

      const restoredProfile: Profile = {
        candidate: {
          name: saved.name || "",
          email: saved.email || "",
          phone: saved.phone || "",
          location: saved.location || "",
          linkedin: saved.linkedin || "",
          github: saved.github || "",
          portfolio: saved.portfolio || "",
        },

        summary: saved.summary || "",

        skills: Array.isArray(saved.skills)
          ? saved.skills
          : [],

        experience:
          Array.isArray(saved.experience)
            ? saved.experience
            : [],

        education:
          Array.isArray(saved.education)
            ? saved.education
            : [],

        projects:
          Array.isArray(saved.projects)
            ? saved.projects
            : [],

        certifications:
          Array.isArray(saved.certifications)
            ? saved.certifications
            : [],

        languages:
          Array.isArray(saved.languages)
            ? saved.languages
            : [],

        preferredJobTitles:
          Array.isArray(
            saved.preferred_job_titles
          )
            ? saved.preferred_job_titles
            : [],

        inferredKeywords:
          Array.isArray(
            saved.inferred_keywords
          )
            ? saved.inferred_keywords
            : [],
      };

      setProfile(restoredProfile);

      setProfileConfirmed(
        saved.profile_confirmed === true
      );

      /*
       * If profile already exists and was confirmed,
       * go directly to Jobs.
       */
      if (saved.profile_confirmed === true) {
        setPage("jobs");
      }
    } catch (err) {
      console.error(
        "Failed to load candidate profile:",
        err
      );
    } finally {
      setLoadingProfile(false);
    }
  };

  /* =========================================================
     FILE SELECT
  ========================================================= */

  const selectFile = (selectedFile?: File) => {
    if (!selectedFile) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (
      !allowedTypes.includes(
        selectedFile.type
      )
    ) {
      setError(
        "Only PDF and DOCX files are supported."
      );

      return;
    }

    if (
      selectedFile.size >
      8 * 1024 * 1024
    ) {
      setError(
        "Maximum file size is 8 MB."
      );

      return;
    }

    setError("");
    setFile(selectedFile);
  };

  /* =========================================================
     ANALYZE RESUME
  ========================================================= */

  const analyze = async () => {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append(
        "resume",
        file
      );

      const response = await fetch(
        `${API_URL}/api/resume/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Resume analysis failed."
        );
      }

      setProfile(data.profile);

      setProfileConfirmed(false);
    } catch (err) {
      console.error(
        "Resume analysis error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Resume analysis failed."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     CONFIRM PROFILE
  ========================================================= */

  const confirmProfile = async () => {
    if (!profile) return;

    setSavingProfile(true);
    setError("");

    try {
      await saveCandidateProfile(
        profile,
        file
      );

      setProfileConfirmed(true);

      /*
       * After successful save,
       * go to Jobs.
       */
      setPage("jobs");
    } catch (err) {
      console.error(
        "Profile save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = async () => {
    try {
      await supabase.auth.signOut();

      setAuthenticated(false);
      setProfile(null);
      setProfileConfirmed(false);
      setFile(null);
      setPage("resume");
    } catch (err) {
      console.error(
        "Logout failed:",
        err
      );
    }
  };

  /* =========================================================
     AUTH LOADING
  ========================================================= */

  if (authLoading) {
    return (
      <div className="authLoading">

        <div className="authLoadingLogo">
          <Sparkles size={20} />
        </div>

        <h2>JobPilot AI</h2>

        <p>
          Checking your account...
        </p>

      </div>
    );
  }

  /* =========================================================
     NOT LOGGED IN
  ========================================================= */

  if (!authenticated) {
    return (
      <Auth
        onAuthenticated={() => {
          setAuthenticated(true);
          loadSavedProfile();
        }}
      />
    );
  }

  /* =========================================================
     LOGGED IN APP
  ========================================================= */

  return (
    <div className="app">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">

        {/* BRAND */}

        <div className="brand">

          <span className="brandIcon">
            <Sparkles size={17} />
          </span>

          <span className="brandText">
            JobPilot
            <small>AI</small>
          </span>

        </div>

        {/* NAVIGATION */}

        <div className="navMenu">

          <button
            className={`navItem ${
              page === "resume"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("resume")
            }
          >
            <FileText size={17} />

            <span>
              Resume
            </span>
          </button>

          <button
            className={`navItem ${
              page === "jobs"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("jobs")
            }
          >
            <BriefcaseBusiness
              size={17}
            />

            <span>
              Jobs
            </span>
          </button>

          <button
            className={`navItem ${
              page === "applications"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("applications")
            }
          >
            <CheckCircle2 size={17} />

            <span>
              Applications
            </span>
          </button>

        </div>

        {/* BOTTOM */}

        <div className="sidebarBottom">

          <div className="safe">
            <span className="safeDot">
              ●
            </span>

            <span>
              Protected & private
            </span>
          </div>

          <button
            className="logoutButton"
            onClick={logout}
          >
            <LogOut size={16} />

            <span>
              Logout
            </span>
          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="main">

        {/* HEADER */}

        <header>

          <div>

            <small>
              {page === "resume"
                ? "MILESTONE 01"
                : page === "jobs"
                ? "MILESTONE 02"
                : "TRACKING"}
            </small>

            <h1>
              {page === "resume"
                ? "Build your AI profile"
                : page === "jobs"
                ? "Find your next opportunity"
                : "Your applications"}
            </h1>

          </div>

          <div className="candidate">
            <UserRound size={15} />

            {profile?.candidate?.name ||
              "Candidate"}
          </div>

        </header>

        {/* CONTENT */}

        <div className="content">

          {loadingProfile ? (
            <div className="profileLoading">

              <Loader2
                size={24}
                className="spin"
              />

              <p>
                Loading your profile...
              </p>

            </div>
          ) : page === "resume" ? (
            profile ? (
              <Profile
                profile={profile}
                profileConfirmed={
                  profileConfirmed
                }
                saving={
                  savingProfile
                }
                error={error}
                reset={() => {
                  setFile(null);
                  setProfile(null);
                  setProfileConfirmed(
                    false
                  );
                  setError("");
                }}
                confirmProfile={
                  confirmProfile
                }
              />
            ) : (
              <ResumeUpload
                file={file}
                error={error}
                loading={loading}
                inputRef={inputRef}
                selectFile={selectFile}
                analyze={analyze}
                removeFile={() => {
                  setFile(null);
                  setError("");

                  if (inputRef.current) {
                    inputRef.current.value =
                      "";
                  }
                }}
              />
            )
          ) : page === "jobs" ? (
            <JobsPage
              onApplicationCreated={() => setPage("applications")}
            />
          ) : (
            <ApplicationsPage />
          )}

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   RESUME UPLOAD
========================================================= */

function ResumeUpload({
  file,
  error,
  loading,
  inputRef,
  selectFile,
  analyze,
  removeFile,
}: {
  file: File | null;

  error: string;

  loading: boolean;

  inputRef: React.RefObject<HTMLInputElement | null>;

  selectFile: (
    file?: File
  ) => void;

  analyze: () => void;

  removeFile: () => void;
}) {
  return (
    <section>

      {/* HERO */}

      <div className="hero">

        <div className="tag">
          <Sparkles size={14} />

          AI Resume Analyzer
        </div>

        <h2>
          Turn your resume into an
          intelligent job profile.
        </h2>

        <p>
          Upload your latest resume and
          AI will extract the information
          we need for future job matching.
        </p>

      </div>

      {/* UPLOAD */}

      <div
        className="upload"
        onClick={() =>
          inputRef.current?.click()
        }
      >

        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".pdf,.docx"
          onChange={(e) =>
            selectFile(
              e.target.files?.[0]
            )
          }
        />

        <div className="uploadIcon">
          <UploadCloud size={28} />
        </div>

        <h3>
          {file
            ? file.name
            : "Drop your resume here"}
        </h3>

        <p>
          {file
            ? `${(
                file.size /
                1024 /
                1024
              ).toFixed(2)} MB`
            : "or click to browse • PDF or DOCX • Max 8 MB"}
        </p>

        {file && (
          <button
            className="remove"
            onClick={(e) => {
              e.stopPropagation();
              removeFile();
            }}
          >
            <X size={14} />

            Remove
          </button>
        )}

      </div>

      {/* ERROR */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {/* ANALYZE */}

      <button
        className="primary"
        disabled={
          !file || loading
        }
        onClick={analyze}
      >
        {loading ? (
          <>
            <Loader2
              size={17}
              className="spin"
            />

            Analyzing...
          </>
        ) : (
          <>
            Analyze Resume

            <ChevronRight
              size={17}
            />
          </>
        )}
      </button>

      {/* STEPS */}

      <div className="steps">

        <b>01 Upload</b>

        <i />

        02 AI Analysis

        <i />

        03 Verify Profile

        <i />

        04 Find Jobs

      </div>

    </section>
  );
}

/* =========================================================
   PROFILE
========================================================= */

function Profile({
  profile,
  profileConfirmed,
  saving,
  error,
  reset,
  confirmProfile,
}: {
  profile: Profile;

  profileConfirmed: boolean;

  saving: boolean;

  error: string;

  reset: () => void;

  confirmProfile: () => void;
}) {
  const c = profile.candidate;

  return (
    <section>

      {/* HEADER */}

      <div className="profileHead">

        <div>

          <div className="tag">

            <CheckCircle2
              size={14}
            />

            Analysis complete

          </div>

          <h2>
            Candidate profile
          </h2>

          <p>
            Review the information
            extracted from your resume.
          </p>

        </div>

        <button
          className="secondary"
          onClick={reset}
        >
          Analyze another resume
        </button>

      </div>

      {/* PROFILE GRID */}

      <div className="grid">

        {/* CANDIDATE */}

        <Card
          title={
            c.name ||
            "Candidate"
          }
        >

          <div className="avatar">
            {(c.name || "U")
              .charAt(0)
              .toUpperCase()}
          </div>

          <p>
            {profile.preferredJobTitles
              .slice(0, 2)
              .join(" • ")}
          </p>

          <div className="contact">

            {[
              c.email,
              c.phone,
              c.location,
              c.linkedin,
              c.github,
              c.portfolio,
            ]
              .filter(Boolean)
              .map((value) => (
                <span key={value}>
                  {value}
                </span>
              ))}

          </div>

        </Card>

        {/* SUMMARY */}

        <Card title="Professional Summary">

          <p>
            {profile.summary ||
              "No summary found."}
          </p>

        </Card>

      </div>

      {/* SKILLS */}

      <Card title="Skills">

        <div className="chips">

          {profile.skills.length ? (
            profile.skills.map(
              (skill) => (
                <span key={skill}>
                  {skill}
                </span>
              )
            )
          ) : (
            <span>
              No skills found
            </span>
          )}

        </div>

      </Card>

      {/* EXPERIENCE + EDUCATION */}

      <div className="grid">

        <Card title="Experience">

          {profile.experience.length ? (
            profile.experience.map(
              (experience, index) => (
                <div
                  className="item"
                  key={index}
                >

                  <b>
                    {experience.role}
                  </b>

                  <strong>
                    {experience.company}
                  </strong>

                  <small>
                    {experience.startDate}
                    {" — "}
                    {experience.endDate}
                  </small>

                  <p>
                    {
                      experience.description
                    }
                  </p>

                  <div className="chips">

                    {experience.technologies?.map(
                      (technology) => (
                        <span
                          key={technology}
                        >
                          {technology}
                        </span>
                      )
                    )}

                  </div>

                </div>
              )
            )
          ) : (
            <p>
              No experience found.
            </p>
          )}

        </Card>

        <Card title="Education">

          {profile.education.length ? (
            profile.education.map(
              (education, index) => (
                <div
                  className="item"
                  key={index}
                >

                  <b>
                    {education.degree}
                  </b>

                  <strong>
                    {
                      education.institution
                    }
                  </strong>

                  <small>
                    {education.field}

                    {education.startDate ||
                    education.endDate
                      ? ` • ${education.startDate} — ${education.endDate}`
                      : ""}
                  </small>

                  {education.grade && (
                    <small>
                      Grade:{" "}
                      {education.grade}
                    </small>
                  )}

                </div>
              )
            )
          ) : (
            <p>
              No education found.
            </p>
          )}

        </Card>

      </div>

      {/* PROJECTS */}

      <Card title="Projects">

        <div className="projectGrid">

          {profile.projects.length ? (
            profile.projects.map(
              (project, index) => (
                <div
                  className="project"
                  key={index}
                >

                  <b>
                    {project.name}
                  </b>

                  <p>
                    {project.description}
                  </p>

                  <div className="chips">

                    {project.technologies?.map(
                      (technology) => (
                        <span
                          key={technology}
                        >
                          {technology}
                        </span>
                      )
                    )}

                  </div>

                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View project
                    </a>
                  )}

                </div>
              )
            )
          ) : (
            <p>
              No projects found.
            </p>
          )}

        </div>

      </Card>

      {/* CERTIFICATIONS */}

      <Card title="Certifications">

        <div className="chips">

          {profile.certifications.length ? (
            profile.certifications.map(
              (certification, index) => (
                <span key={index}>

                  {typeof certification ===
                  "string"
                    ? certification
                    : certification.name}

                </span>
              )
            )
          ) : (
            <span>
              No certifications found
            </span>
          )}

        </div>

      </Card>

      {/* LANGUAGES */}

      <Card title="Languages">

        <div className="chips">

          {profile.languages.length ? (
            profile.languages.map(
              (language) => (
                <span key={language}>
                  {language}
                </span>
              )
            )
          ) : (
            <span>
              No languages found
            </span>
          )}

        </div>

      </Card>

      {/* JOB TITLES + KEYWORDS */}

      <div className="grid">

        <Card title="Preferred Job Titles">

          <div className="chips">

            {profile.preferredJobTitles.length ? (
              profile.preferredJobTitles.map(
                (title) => (
                  <span key={title}>
                    {title}
                  </span>
                )
              )
            ) : (
              <span>
                No preferred titles found
              </span>
            )}

          </div>

        </Card>

        <Card title="Resume Keywords">

          <div className="chips">

            {profile.inferredKeywords.length ? (
              profile.inferredKeywords.map(
                (keyword) => (
                  <span key={keyword}>
                    {keyword}
                  </span>
                )
              )
            ) : (
              <span>
                No keywords found
              </span>
            )}

          </div>

        </Card>

      </div>

      {/* ERROR */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {/* CONFIRM */}

      <div className="confirm">

        <div>

          <CheckCircle2 size={20} />

          <span>

            <b>
              {profileConfirmed
                ? "Profile saved"
                : "Profile ready for verification"}
            </b>

            <small>
              {profileConfirmed
                ? "Your profile is saved securely in Supabase."
                : "Confirm your profile to continue to job matching."}
            </small>

          </span>

        </div>

        {!profileConfirmed && (
          <button
            className="primary"
            disabled={saving}
            onClick={
              confirmProfile
            }
          >
            {saving ? (
              <>
                <Loader2
                  size={16}
                  className="spin"
                />

                Saving...
              </>
            ) : (
              <>
                Confirm Profile

                <ChevronRight
                  size={16}
                />
              </>
            )}
          </button>
        )}

      </div>

    </section>
  );
}

/* =========================================================
   CARD
========================================================= */

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">

      <h3>
        {title}
      </h3>

      {children}

    </div>
  );
}

/* =========================================================
   JOBS PAGE
========================================================= */

function JobsPage({
  onApplicationCreated,
}: {
  onApplicationCreated: () => void;
}) {
  const [matches, setMatches] =
    React.useState<JobMatch[]>([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState("");

  const [search, setSearch] =
    React.useState("");

  const [remoteOnly, setRemoteOnly] =
    React.useState(false);

  const [minimumMatch, setMinimumMatch] =
    React.useState(0);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError("");

      await refreshCandidateMatches();

      const data =
        await getCandidateMatches();

      setMatches(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load jobs."
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadMatches();
  }, []);

  const filteredMatches =
    matches.filter((match) => {
      const job = match.jobs;
      const application = getApplicationUrl(job);

      const query =
        search.toLowerCase().trim();

      const matchesSearch =
        !query ||
        job.title
          .toLowerCase()
          .includes(query) ||
        job.company
          .toLowerCase()
          .includes(query) ||
        (job.location || "")
          .toLowerCase()
          .includes(query);

      const matchesRemote =
        !remoteOnly || job.remote;

      const matchesScore =
        match.match_score >= minimumMatch;

      return (
        matchesSearch &&
        matchesRemote &&
        matchesScore
      );
    });

  const excellentMatches =
    matches.filter(
      (match) =>
        match.match_score >= 90
    ).length;

  const strongMatches =
    matches.filter(
      (match) =>
        match.match_score >= 75
    ).length;

  const remoteMatches =
    matches.filter(
      (match) =>
        match.jobs.remote
    ).length;

  return (
    <div className="jobs-page">
      <div className="jobs-header">
        <div>
          <h1>Recommended Jobs</h1>

          <p>
            Real job listings matched
            to your profile.
          </p>
        </div>

        <button
          className="refresh-jobs-btn"
          onClick={loadMatches}
          disabled={loading}
        >
          {loading
            ? "Refreshing..."
            : "Refresh Jobs"}
        </button>
      </div>

      <div className="jobs-stats">
        <div className="job-stat-card">
          <span>Total Matches</span>
          <strong>
            {matches.length}
          </strong>
        </div>

        <div className="job-stat-card">
          <span>90%+ Match</span>
          <strong>
            {excellentMatches}
          </strong>
        </div>

        <div className="job-stat-card">
          <span>75%+ Match</span>
          <strong>
            {strongMatches}
          </strong>
        </div>

        <div className="job-stat-card">
          <span>Remote</span>
          <strong>
            {remoteMatches}
          </strong>
        </div>
      </div>

      <div className="jobs-toolbar">
        <input
          type="text"
          placeholder="Search jobs, companies or locations..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />

        <select
          value={minimumMatch}
          onChange={(event) =>
            setMinimumMatch(
              Number(
                event.target.value
              )
            )
          }
        >
          <option value={0}>
            All Matches
          </option>

          <option value={90}>
            90%+ Match
          </option>

          <option value={80}>
            80%+ Match
          </option>

          <option value={70}>
            70%+ Match
          </option>
        </select>

        <label className="remote-filter">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(event) =>
              setRemoteOnly(
                event.target.checked
              )
            }
          />

          Remote Only
        </label>
      </div>

      {error && (
        <div className="jobs-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="jobs-empty">
          <div className="jobs-loading-spinner" />

          <h3>
            Finding your best jobs...
          </h3>

          <p>
            We're matching your profile
            against current listings.
          </p>
        </div>
      ) : filteredMatches.length ===
        0 ? (
        <div className="jobs-empty">
          <h3>
            No matching jobs found
          </h3>

          <p>
            Try changing your filters
            or refresh the job feed.
          </p>
        </div>
      ) : (
        <div className="jobs-list">
          {filteredMatches.map(
            (match) => (
              <JobMatchCard
                key={match.id}
                match={match}
                onApplicationCreated={onApplicationCreated}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function JobMatchCard({
  match,
  onApplicationCreated,
}: {
  match: JobMatch;
  onApplicationCreated: () => void;
}) {
  const job = match.jobs;
  const [preparing, setPreparing] = useState(false);
  const [applicationError, setApplicationError] = useState("");

  const prepare = async () => {
    const confirmed = window.confirm(
      `Allow JobPilot to use your confirmed profile and this job's details to prepare an application for ${job.company}? Nothing will be submitted to the employer.`
    );

    if (!confirmed) return;

    try {
      setPreparing(true);
      setApplicationError("");
      await startApplicationPreparation(job.id);
      onApplicationCreated();
    } catch (error) {
      setApplicationError(
        error instanceof Error
          ? error.message
          : "Application preparation failed."
      );
    } finally {
      setPreparing(false);
    }
  };

  const application = getApplicationUrl(job);

  const scoreClass =
    match.match_score >= 90
      ? "excellent"
      : match.match_score >= 75
        ? "strong"
        : "good";

  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      )
    : "Recently";

  return (
    <div className="job-match-card">
      <div className="job-card-main">
        <div className="job-card-title-row">
          <div>
            <h2>{job.title}</h2>

            <p className="job-company">
              {job.company}
            </p>
          </div>

          <div className={`match-score ${scoreClass}`}>
            <strong>{match.match_score}%</strong>
            <span>Match</span>
          </div>
        </div>

        <div className="job-meta">
          <span>
            📍 {job.location || "Location not specified"}
          </span>

          {job.remote && (
            <span className="remote-badge">
              Remote
            </span>
          )}

          {job.salary && (
            <span>💰 {job.salary}</span>
          )}

          <span>📅 {postedDate}</span>
        </div>

        <div className="job-verification">
          <span className="live-dot" />

          <strong>Live listing</strong>

          <span>
            Source: {job.source_name || job.source}
          </span>

          {job.link_checked_at && (
            <span>
              Checked{" "}
              {new Date(
                job.link_checked_at
              ).toLocaleDateString("en-IN")}
            </span>
          )}
        </div>

        <p className="job-match-reason">
          {match.match_reason}
        </p>

        {match.matched_skills.length > 0 && (
          <div className="skills-section">
            <span className="skills-title">
              Your matching skills
            </span>

            <div className="skill-list">
              {match.matched_skills.map((skill) => (
                <span
                  className="skill matched"
                  key={skill}
                >
                  ✓ {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {match.missing_skills.length > 0 && (
          <div className="skills-section">
            <span className="skills-title">
              Skills you may need
            </span>

            <div className="skill-list">
              {match.missing_skills
                .slice(0, 6)
                .map((skill) => (
                  <span
                    className="skill missing"
                    key={skill}
                  >
                    {skill}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      
<div className="job-card-actions">
  <button
    type="button"
    className="view-job-btn"
    onClick={prepare}
    disabled={preparing}
  >
    {preparing ? "Preparing..." : "Prepare Application with AI"}
  </button>
  {application.url ? (
    <a
      href={application.url}
      target="_blank"
      rel="noopener noreferrer"
      className="view-job-btn"
    >
      {application.label}
    </a>
  ) : (
    <button
      type="button"
      disabled
      className="view-job-btn"
    >
      Application link unavailable
    </button>
  )}

  {application.destination === "company" &&
    job.source_job_url && (
      <a
        href={job.source_job_url}
        target="_blank"
        rel="noopener noreferrer"
        className="view-job-btn"
      >
        View original Adzuna listing
      </a>
    )}
</div>

{applicationError && (
  <div className="jobs-error">
    {applicationError}
  </div>
)}

    </div>
  );
}


function JobCard({
  job,
}: {
  job: import("./services/job.matching").JobMatch;
}) {
  const scoreClass =
    job.matchScore >= 80
      ? "excellent"
      : job.matchScore >= 60
      ? "good"
      : "normal";

  return (
    <article className="jobCard">

      <div className="jobCardTop">

        <div className="companyLogo">
          {job.company
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="jobMain">

          <h3>
            {job.title}
          </h3>

          <p className="jobCompany">
            {job.company}
          </p>

          <div className="jobMeta">

            {job.location && (
              <span>
                📍 {job.location}
              </span>
            )}

            {job.remote && (
              <span>
                🌐 Remote
              </span>
            )}

            {job.salary && (
              <span>
                💰 {job.salary}
              </span>
            )}

          </div>

        </div>

        <div
          className={`matchScore ${scoreClass}`}
        >

          <strong>
            {job.matchScore}%
          </strong>

          <span>
            Match
          </span>

        </div>

      </div>

      <p className="jobDescription">
        {job.description}
      </p>

      <div className="jobSkills">

        {job.matchedSkills
          .slice(0, 8)
          .map((skill) => (
            <span
              className="matched"
              key={skill}
            >
              ✓ {skill}
            </span>
          ))}

        {job.missingSkills
          .slice(0, 3)
          .map((skill) => (
            <span
              className="missing"
              key={skill}
            >
              {skill}
            </span>
          ))}

      </div>

      <div className="jobCardBottom">

        <div className="matchReason">

          <Sparkles size={14} />

          {job.matchReason}

        </div>

        <div className="jobActions">

          {job.job_url && (
            <a
              className="secondary"
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
            >
              View Job
            </a>
          )}

          <button
            className="primary"
            onClick={() => {
              alert(
                `Application flow for "${job.title}" will be built in Milestone 04.`
              );
            }}
          >
            Apply
            <ChevronRight
              size={16}
            />
          </button>

        </div>

      </div>

    </article>
  );
}

/* =========================================================
   APPLICATIONS PAGE
========================================================= */

function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getApplications();
      setApplications(data);
      if (selected) {
        setSelected(data.find((item) => item.id === selected.id) || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const statusLabel = (status: string) => status.replaceAll("_", " ");

  if (loading) {
    return (
      <div className="jobs-empty">
        <Loader2 className="spin" size={25} />
        <h3>Loading your applications...</h3>
      </div>
    );
  }

  return (
    <section className="applications-page">
      <div className="jobs-header">
        <div>
          <h1>My Applications</h1>
          <p>Manage and review your AI-prepared applications.</p>
        </div>
        <button className="refresh-jobs-btn" onClick={loadApplications}>
          Refresh
        </button>
      </div>

      <div className="jobs-stats">
        <div className="job-stat-card">
          <span>Total Applications</span>
          <strong>{applications.length}</strong>
        </div>
        <div className="job-stat-card">
          <span>Awaiting Approval</span>
          <strong>{applications.filter((item) => item.status === "awaiting_approval").length}</strong>
        </div>
        <div className="job-stat-card">
          <span>Submitted</span>
          <strong>{applications.filter((item) => item.status === "submitted" || item.status === "confirmation_received").length}</strong>
        </div>
      </div>

      {error && <div className="jobs-error">{error}</div>}

      {applications.length === 0 ? (
        <div className="jobs-empty">
          <FileText size={32} />
          <h3>No applications yet</h3>
          <p>Find a suitable job and prepare your first application with AI.</p>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map((application) => (
            <div className="job-match-card" key={application.id}>
              <div className="job-card-main">
                <div className="job-card-title-row">
                  <div>
                    <h2>{application.jobs?.title || "Job application"}</h2>
                    <p className="job-company">{application.jobs?.company || "Company"}</p>
                  </div>
                  <span className={`application-status ${application.status}`}>
                    {statusLabel(application.status)}
                  </span>
                </div>
                <div className="job-meta">
                  <span>{application.jobs?.location || "Location not specified"}</span>
                  <span>Created {new Date(application.created_at).toLocaleDateString("en-IN")}</span>
                </div>
                <div className="job-card-actions">
                  <button className="view-job-btn" onClick={() => setSelected(application)}>
                    Review Application
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="application-review-overlay">
          <div className="application-review">
            <div className="application-review-header">
              <div>
                <span className="tag">AI APPLICATION REVIEW</span>
                <h2>{selected.jobs?.title || "Application Review"}</h2>
                <p>{selected.jobs?.company || "Company"}</p>
              </div>
              <button className="secondary" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="application-review-body">
              <label>Application Status</label>
              <p className={`application-status ${selected.status}`}>{statusLabel(selected.status)}</p>

              <label>Cover Letter</label>
              <textarea rows={12} value={selected.cover_letter || ""} readOnly />

              <label>Professional Summary</label>
              <textarea rows={5} value={selected.prepared_answers?.professional_summary || ""} readOnly />

              <label>Relevant Experience</label>
              <textarea rows={6} value={selected.prepared_answers?.relevant_experience || ""} readOnly />

              <label>Relevant Skills</label>
              <div className="chips">
                {selected.prepared_answers?.relevant_skills?.map((skill) => <span key={skill}>{skill}</span>)}
              </div>

              <label>Why Interested</label>
              <textarea rows={4} value={selected.prepared_answers?.why_interested || ""} readOnly />

              {selected.prepared_answers?.missing_information?.length ? (
                <>
                  <label>Information requiring attention</label>
                  <ul>
                    {selected.prepared_answers.missing_information.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </>
              ) : null}

              <p className="application-review-note">
                Review mode only. Editing, final approval and employer submission will be enabled in the next milestone.
              </p>
            </div>

            <div className="application-review-footer">
              <button className="secondary" onClick={() => setSelected(null)}>Close Review</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
