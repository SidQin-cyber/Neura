-- 新增 fts_document_text 字段以支持新的 Prompt 输出格式
-- Migration: Add fts_document_text field for new prompt format
-- Created: 2025-01-26

-- 1. 为 resumes 表添加新的 TEXT 字段来存储原始 fts_document 文本
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS fts_document_text TEXT;

-- 2. 为 jobs 表也添加相同字段（保持一致性）
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS fts_document_text TEXT;

-- 3. 创建新的触发器函数，从 fts_document_text 生成 tsvector
CREATE OR REPLACE FUNCTION public.update_fts_from_text()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果 fts_document_text 字段有值，就使用它来生成 tsvector
  -- 否则回退到原有的字段拼接逻辑
  IF NEW.fts_document_text IS NOT NULL AND NEW.fts_document_text != '' THEN
    NEW.fts_document := to_tsvector('chinese_zh', NEW.fts_document_text);
  ELSE
    -- 回退到原有逻辑（针对 resumes 表）
    IF TG_TABLE_NAME = 'resumes' THEN
      NEW.fts_document := to_tsvector('chinese_zh', 
        COALESCE(NEW.name, '') || ' ' ||
        COALESCE(NEW.current_title, '') || ' ' ||
        COALESCE(NEW.current_company, '') || ' ' ||
        COALESCE(NEW.location, '') || ' ' ||
        COALESCE(NEW.age::TEXT, '') || ' ' ||
        COALESCE(array_to_string(NEW.skills, ' '), '') || ' ' ||
        COALESCE(NEW.raw_data::TEXT, '')
      );
    -- 回退到原有逻辑（针对 jobs 表）
    ELSIF TG_TABLE_NAME = 'jobs' THEN
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 替换原有的触发器
DROP TRIGGER IF EXISTS update_resume_fts_trigger ON public.resumes;
DROP TRIGGER IF EXISTS update_job_fts_trigger ON public.jobs;

CREATE TRIGGER update_resume_fts_from_text_trigger
  BEFORE INSERT OR UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.update_fts_from_text();

CREATE TRIGGER update_job_fts_from_text_trigger
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_fts_from_text();

-- 5. 为新字段添加注释
COMMENT ON COLUMN public.resumes.fts_document_text IS '用于全文搜索的原始文本内容，由新Prompt生成';
COMMENT ON COLUMN public.jobs.fts_document_text IS '用于全文搜索的原始文本内容，由新Prompt生成';

-- 6. 创建用于新格式数据注入的函数
CREATE OR REPLACE FUNCTION public.insert_resume_with_new_format(
  p_candidate JSONB,
  p_embedding_text TEXT,
  p_fts_document TEXT,
  p_owner_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
  embedding_vector VECTOR(1536);
BEGIN
  -- 生成 embedding（这里需要调用外部API，暂时设为NULL）
  -- embedding_vector := generate_embedding_from_text(p_embedding_text);
  
  -- 插入数据
  INSERT INTO public.resumes (
    owner_id,
    name,
    email, 
    phone,
    age,
    current_title,
    current_company,
    location,
    years_of_experience,
    expected_salary_min,
    expected_salary_max,
    skills,
    education,
    experience,
    certifications,
    languages,
    raw_data,
    fts_document_text,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_owner_id,
    (p_candidate->>'name')::TEXT,
    (p_candidate->>'email')::TEXT,
    (p_candidate->>'phone')::TEXT,
    (p_candidate->>'age')::INTEGER,
    (p_candidate->>'current_title')::TEXT,
    (p_candidate->>'current_company')::TEXT,
    (p_candidate->>'location')::TEXT,
    (p_candidate->>'years_of_experience')::INTEGER,
    (p_candidate->>'expected_salary_min')::INTEGER,
    (p_candidate->>'expected_salary_max')::INTEGER,
    CASE 
      WHEN p_candidate->'skills' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(p_candidate->'skills'))
      ELSE NULL 
    END,
    p_candidate->'education',
    p_candidate->'experience',
    p_candidate->'certifications',
    p_candidate->'languages',
    p_candidate,
    p_fts_document,
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$; 