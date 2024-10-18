export type ZendeskHelpCenterType = {
  id: number;
  name: string;
  subdomain: string;
  locale: string;
  created_at: string;
  updated_at: string;
  description: string;
  restricted_to_groups: boolean;
  tags: string[];
  brand_id: number;
  host_mapping: string | null;
  active: boolean;
};

export type ZendeskCategoriesResponse = {
  categories: ZendeskCategoryType[];
  page: number;
  previous_page: string | null;
  next_page: string | null;
  per_page: number;
  count: number;
};

export type ZendeskCategoryType = {
  id: number;
  name: string;
  description: string | null;
  locale: string;
  source_locale: string;
  url: string;
  html_url: string;
  outdated: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ZendeskArticlesResponse = {
  articles: ZendeskArticleType[];
  page: number;
  previous_page: string | null;
  next_page: string | null;
  per_page: number;
  count: number;
};

export type ZendeskArticleType = {
  id: number;
  url: string;
  html_url: string;
  title: string;
  body: string;
  locale: string;
  source_locale: string;
  author_id: number;
  comments_disabled: boolean;
  outdated: boolean;
  label_names: string[];
  draft: boolean;
  promoted: boolean;
  position: number;
  vote_sum: number;
  vote_count: number;
  section_id: number;
  created_at: string;
  updated_at: string;
  name: string;
};
