-- Neura AI招聘平台数据库Schema
-- 初始迁移文件
-- 创建时间: 2024

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 用户配置文件表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT CHECK (role IN ('recruiter', 'hr_manager', 'admin')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 候选人简历表
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  years_of_experience INTEGER,
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  skills TEXT[],
  education JSONB,
  experience JSONB,
  certifications JSONB,
  languages JSONB,
  raw_data JSONB,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  embedding VECTOR(1536), -- OpenAI embedding维度
  fts_document TSVECTOR, -- 全文搜索文档
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 职位表
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  skills_required TEXT[],
  experience_required INTEGER,
  education_required TEXT,
  industry TEXT,
  department TEXT,
  embedding VECTOR(1536), -- OpenAI embedding维度
  fts_document TSVECTOR, -- 全文搜索文档
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'filled', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户交互记录表
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('view', 'like', 'dislike', 'contact', 'interview', 'offer')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 候选人-职位匹配表
CREATE TABLE IF NOT EXISTS candidate_job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  ai_score FLOAT,
  manual_score FLOAT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('candidate', 'job')),
  results_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_owner_id ON resumes(owner_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_resumes_location ON resumes(location);
CREATE INDEX IF NOT EXISTS idx_resumes_experience ON resumes(years_of_experience);
CREATE INDEX IF NOT EXISTS idx_resumes_skills ON resumes USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);
CREATE INDEX IF NOT EXISTS idx_resumes_fts ON resumes USING GIN(fts_document);

CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs USING GIN(skills_required);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING GIN(fts_document);

CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_candidate_id ON interactions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interactions_job_id ON interactions(job_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_matches_candidate_id ON candidate_job_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_job_id ON candidate_job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON candidate_job_matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score ON candidate_job_matches(ai_score);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_type ON search_history(search_type);

-- 向量搜索索引
CREATE INDEX IF NOT EXISTS idx_resumes_embedding ON resumes USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops);

-- 创建中文全文搜索配置
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese_zh') THEN
    CREATE TEXT SEARCH CONFIGURATION public.chinese_zh ( COPY = pg_catalog.simple );
  END IF;
END $$;

-- 创建辅助函数
CREATE OR REPLACE FUNCTION normalize_search_query(query_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- 清理和标准化查询文本
  RETURN trim(regexp_replace(query_text, '[^\w\s\u4e00-\u9fff]', ' ', 'g'));
END;
$$;

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON candidate_job_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建FTS文档更新触发器
CREATE OR REPLACE FUNCTION update_resume_fts_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_document := to_tsvector('chinese_zh', 
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.current_title, '') || ' ' ||
    COALESCE(NEW.current_company, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(array_to_string(NEW.skills, ' '), '') || ' ' ||
    COALESCE(NEW.raw_data::TEXT, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_job_fts_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_document := to_tsvector('chinese_zh', 
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.company, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.requirements, '') || ' ' ||
    COALESCE(array_to_string(NEW.skills_required, ' '), '') || ' ' ||
    COALESCE(NEW.industry, '') || ' ' ||
    COALESCE(NEW.department, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_resume_fts_trigger 
  BEFORE INSERT OR UPDATE ON resumes 
  FOR EACH ROW EXECUTE FUNCTION update_resume_fts_document();

CREATE TRIGGER update_job_fts_trigger 
  BEFORE INSERT OR UPDATE ON jobs 
  FOR EACH ROW EXECUTE FUNCTION update_job_fts_document(); 