import type { MeshSchema } from "meshql-core";

export const foliyoSchema: MeshSchema = {
  entities: {
    profile: {
      type: {},
      fields: [
        "id", "user_id", "name", "headline", "bio",
        "avatar_url", "location", "website",
        "github", "linkedin", "twitter",
      ],
      table: "profile",
    },
    skill: {
      type: {},
      fields: ["id", "user_id", "name", "level", "category", "sort_order"],
      table: "skills",
    },
    project: {
      type: {},
      fields: [
        "id", "user_id", "title", "description", "url",
        "repo_url", "article_url", "image_url", "tags", "featured", "sort_order",
      ],
      table: "projects",
    },
    experience: {
      type: {},
      fields: [
        "id", "user_id", "company", "role", "location",
        "start_date", "end_date", "description", "article_url", "sort_order",
      ],
      table: "experience",
    },
    education: {
      type: {},
      fields: [
        "id", "user_id", "institution", "degree",
        "field", "start_date", "end_date", "description", "sort_order",
      ],
      table: "education",
    },
    certification: {
      type: {},
      fields: [
        "id", "user_id", "name", "issuer", "credential_id", "credential_url",
        "issued_at", "expires_at", "description", "sort_order",
      ],
      table: "certifications",
    },
    language: {
      type: {},
      fields: ["id", "user_id", "name", "proficiency", "sort_order"],
      table: "languages",
    },
    portfolio: {
      type: {},
      fields: [
        "id", "user_id", "name", "slug", "description",
        "theme_slug", "is_public", "is_default", "sort_order",
        "headline", "bio",
        "show_skills", "show_projects", "show_experience", "show_education",
        "show_certifications", "show_languages",
      ],
      table: "portfolios",
    },
    resume: {
      type: {},
      fields: [
        "id", "portfolio_id", "user_id", "name",
        "theme_slug", "is_public", "share_token", "view_count",
      ],
      table: "resumes",
    },
    post: {
      type: {},
      fields: [
        "id", "user_id", "title", "slug", "content",
        "excerpt", "cover_image", "tags",
        "published_at", "status",
      ],
      table: "blog_posts",
    },
  },
  joins: {
    "portfolio.skills": {
      entity: "skill",
      on: "portfolio_skills.portfolio_id = portfolios.id AND portfolio_skills.skill_id = skills.id",
      type: "many",
    },
    "portfolio.projects": {
      entity: "project",
      on: "portfolio_projects.portfolio_id = portfolios.id AND portfolio_projects.project_id = projects.id",
      type: "many",
    },
    "portfolio.experience": {
      entity: "experience",
      on: "portfolio_experience.portfolio_id = portfolios.id AND portfolio_experience.experience_id = experience.id",
      type: "many",
    },
    "portfolio.education": {
      entity: "education",
      on: "portfolio_education.portfolio_id = portfolios.id AND portfolio_education.education_id = education.id",
      type: "many",
    },
    "portfolio.certifications": {
      entity: "certification",
      on: "portfolio_certifications.portfolio_id = portfolios.id AND portfolio_certifications.certification_id = certifications.id",
      type: "many",
    },
    "portfolio.languages": {
      entity: "language",
      on: "portfolio_languages.portfolio_id = portfolios.id AND portfolio_languages.language_id = languages.id",
      type: "many",
    },
    "portfolio.resumes": {
      entity: "resume",
      on: "resumes.portfolio_id = portfolios.id",
      type: "many",
    },
    "profile.portfolios": {
      entity: "portfolio",
      on: "portfolios.user_id = profile.user_id",
      type: "many",
    },
  },
};
