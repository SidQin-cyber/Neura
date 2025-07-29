-- 集成关键词库到搜索系统
-- Migration: Integrate Keyword Library into Search Functions
-- Created: 2025-01-15 20:10:00

-- 1. 创建关键词匹配和权重计算函数
CREATE OR REPLACE FUNCTION calculate_keyword_boost(
  query_text TEXT,
  target_text TEXT
)
RETURNS REAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  keyword_record RECORD;
  boost_score REAL := 0.0;
  query_words TEXT[];
  word TEXT;
  normalized_target TEXT;
  alias_text TEXT;
BEGIN
  -- 输入验证
  IF query_text IS NULL OR target_text IS NULL OR 
     trim(query_text) = '' OR trim(target_text) = '' THEN
    RETURN 0.0;
  END IF;

  -- 标准化目标文本
  normalized_target := lower(target_text);
  
  -- 分割查询词汇
  query_words := string_to_array(lower(trim(query_text)), ' ');
  
  -- 遍历关键词库，查找匹配项
  FOR keyword_record IN 
    SELECT keyword, weight, aliases, is_active 
    FROM keyword_library 
    WHERE is_active = true
  LOOP
    -- 检查主关键词匹配
    IF position(lower(keyword_record.keyword) IN normalized_target) > 0 THEN
      boost_score := boost_score + (keyword_record.weight - 1.0) * 0.3;
    END IF;
    
    -- 检查别名匹配
    IF keyword_record.aliases IS NOT NULL THEN
      FOREACH alias_text IN ARRAY keyword_record.aliases
      LOOP
        IF position(lower(alias_text) IN normalized_target) > 0 THEN
          boost_score := boost_score + (keyword_record.weight - 1.0) * 0.2;
        END IF;
      END LOOP;
    END IF;
    
    -- 检查查询词汇中是否包含关键词
    FOREACH word IN ARRAY query_words
    LOOP
      IF word IS NOT NULL AND trim(word) != '' THEN
        -- 主关键词匹配
        IF lower(keyword_record.keyword) = word THEN
          boost_score := boost_score + (keyword_record.weight - 1.0) * 0.4;
        END IF;
        
        -- 别名匹配
        IF keyword_record.aliases IS NOT NULL THEN
          FOREACH alias_text IN ARRAY keyword_record.aliases
          LOOP
            IF lower(alias_text) = word THEN
              boost_score := boost_score + (keyword_record.weight - 1.0) * 0.3;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  -- 限制boost范围，避免过度提升
  RETURN GREATEST(0.0, LEAST(boost_score, 1.0));
END;
$$;

-- 2. 创建增强的候选人搜索函数，集成关键词库
CREATE OR REPLACE FUNCTION search_candidates_with_keywords(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL   DEFAULT 0.0,
  match_count          INT    DEFAULT 15,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active'
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  email                 TEXT,
  phone                 TEXT,
  current_title         TEXT,
  current_company       TEXT,
  location              TEXT,
  years_of_experience   INT,
  expected_salary_min   INT,
  expected_salary_max   INT,
  skills                TEXT[],
  education             JSONB,
  experience            JSONB,
  certifications        JSONB,
  languages             JSONB,
  status                TEXT,
  -- 增强的评分细节
  similarity            REAL,     -- 原始向量相似度
  fts_rank              REAL,     -- 原始FTS分数
  keyword_boost         REAL,     -- 关键词库提升分数
  base_score            REAL,     -- 基础混合分数
  final_score           REAL      -- 最终排序分数
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
  base_vector_weight REAL := 0.6;
  base_fts_weight REAL := 0.4;
BEGIN
  -- 转换查询向量
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
  RETURN QUERY
  WITH base_search AS (
    SELECT 
      r.id,
      r.name,
      r.email,
      r.phone,
      r.current_title,
      r.current_company,
      r.location,
      r.years_of_experience,
      r.expected_salary_min,
      r.expected_salary_max,
      r.skills,
      r.education,
      r.experience,
      r.certifications,
      r.languages,
      r.status,
      
      -- 基础分数计算
      (1 - (r.embedding <=> query_vec))::REAL AS similarity_score,
      ts_rank(r.fts_document, query_tsquery)::REAL AS fts_score,
      
      -- 计算关键词库提升分数
      calculate_keyword_boost(
        query_text,
        COALESCE(r.name, '') || ' ' ||
        COALESCE(r.current_title, '') || ' ' ||
        COALESCE(r.current_company, '') || ' ' ||
        COALESCE(array_to_string(r.skills, ' '), '') || ' ' ||
        COALESCE(r.education::text, '') || ' ' ||
        COALESCE(r.experience::text, '')
      ) AS keyword_boost_score
      
    FROM resumes r
    WHERE 
      r.status = status_filter
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR r.skills && skills_filter)
      -- 宽松的召回条件
      AND ((1 - (r.embedding <=> query_vec)) >= similarity_threshold
           OR r.fts_document @@ query_tsquery)
  ),
  
  scored_results AS (
    SELECT 
      *,
      -- 计算基础混合分数
      (similarity_score * base_vector_weight + fts_score * base_fts_weight)::REAL AS base_combined_score,
      
      -- 应用关键词库提升，计算最终分数
      ((similarity_score * base_vector_weight + fts_score * base_fts_weight) * (1.0 + keyword_boost_score))::REAL AS enhanced_final_score
    FROM base_search
  )
  
  SELECT 
    sr.id,
    sr.name,
    sr.email,
    sr.phone,
    sr.current_title,
    sr.current_company,
    sr.location,
    sr.years_of_experience,
    sr.expected_salary_min,
    sr.expected_salary_max,
    sr.skills,
    sr.education,
    sr.experience,
    sr.certifications,
    sr.languages,
    sr.status,
    sr.similarity_score,
    sr.fts_score,
    sr.keyword_boost_score,
    sr.base_combined_score,
    sr.enhanced_final_score
  FROM scored_results sr
  ORDER BY sr.enhanced_final_score DESC
  LIMIT match_count;
END;
$$;

-- 3. 创建增强的职位搜索函数，集成关键词库
CREATE OR REPLACE FUNCTION search_jobs_with_keywords(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL   DEFAULT 0.0,
  match_count          INT    DEFAULT 15,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active'
)
RETURNS TABLE (
  id                    UUID,
  title                 TEXT,
  company               TEXT,
  location              TEXT,
  employment_type       TEXT,
  salary_min            INT,
  salary_max            INT,
  currency              TEXT,
  description           TEXT,
  requirements          TEXT,
  benefits              TEXT,
  skills_required       TEXT[],
  experience_required   INT,
  education_required    TEXT,
  industry              TEXT,
  department            TEXT,
  status                TEXT,
  -- 增强的评分细节
  similarity            REAL,     -- 原始向量相似度
  fts_rank              REAL,     -- 原始FTS分数
  keyword_boost         REAL,     -- 关键词库提升分数
  base_score            REAL,     -- 基础混合分数
  final_score           REAL      -- 最终排序分数
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
  base_vector_weight REAL := 0.6;
  base_fts_weight REAL := 0.4;
BEGIN
  -- 转换查询向量
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
  RETURN QUERY
  WITH base_search AS (
    SELECT 
      j.id,
      j.title,
      j.company,
      j.location,
      j.employment_type,
      j.salary_min,
      j.salary_max,
      j.currency,
      j.description,
      j.requirements,
      j.benefits,
      j.skills_required,
      j.experience_required,
      j.education_required,
      j.industry,
      j.department,
      j.status,
      
      -- 基础分数计算
      (1 - (j.embedding <=> query_vec))::REAL AS similarity_score,
      ts_rank(j.fts_document, query_tsquery)::REAL AS fts_score,
      
      -- 计算关键词库提升分数
      calculate_keyword_boost(
        query_text,
        COALESCE(j.title, '') || ' ' ||
        COALESCE(j.company, '') || ' ' ||
        COALESCE(j.description, '') || ' ' ||
        COALESCE(j.requirements, '') || ' ' ||
        COALESCE(array_to_string(j.skills_required, ' '), '') || ' ' ||
        COALESCE(j.industry, '') || ' ' ||
        COALESCE(j.department, '')
      ) AS keyword_boost_score
      
    FROM jobs j
    WHERE 
      j.status = status_filter
      AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR j.experience_required >= experience_min)
      AND (experience_max IS NULL OR j.experience_required <= experience_max)
      AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
      AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
      AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
      -- 宽松的召回条件
      AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
           OR j.fts_document @@ query_tsquery)
  ),
  
  scored_results AS (
    SELECT 
      *,
      -- 计算基础混合分数
      (similarity_score * base_vector_weight + fts_score * base_fts_weight)::REAL AS base_combined_score,
      
      -- 应用关键词库提升，计算最终分数
      ((similarity_score * base_vector_weight + fts_score * base_fts_weight) * (1.0 + keyword_boost_score))::REAL AS enhanced_final_score
    FROM base_search
  )
  
  SELECT 
    sr.id,
    sr.title,
    sr.company,
    sr.location,
    sr.employment_type,
    sr.salary_min,
    sr.salary_max,
    sr.currency,
    sr.description,
    sr.requirements,
    sr.benefits,
    sr.skills_required,
    sr.experience_required,
    sr.education_required,
    sr.industry,
    sr.department,
    sr.status,
    sr.similarity_score,
    sr.fts_score,
    sr.keyword_boost_score,
    sr.base_combined_score,
    sr.enhanced_final_score
  FROM scored_results sr
  ORDER BY sr.enhanced_final_score DESC
  LIMIT match_count;
END;
$$;

-- 4. 创建关键词库管理函数
CREATE OR REPLACE FUNCTION add_keyword_to_library(
  p_keyword TEXT,
  p_category TEXT,
  p_weight REAL DEFAULT 1.0,
  p_aliases TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- 验证分类
  IF p_category NOT IN ('company', 'skill', 'position', 'industry', 'education') THEN
    RAISE EXCEPTION 'Invalid category. Must be one of: company, skill, position, industry, education';
  END IF;
  
  -- 验证权重
  IF p_weight < 0.1 OR p_weight > 3.0 THEN
    RAISE EXCEPTION 'Weight must be between 0.1 and 3.0';
  END IF;
  
  -- 插入关键词
  INSERT INTO keyword_library (keyword, category, weight, aliases)
  VALUES (p_keyword, p_category, p_weight, p_aliases)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 5. 创建关键词库统计函数
CREATE OR REPLACE FUNCTION get_keyword_library_stats()
RETURNS TABLE (
  category TEXT,
  count_total BIGINT,
  count_active BIGINT,
  avg_weight REAL,
  max_weight REAL,
  min_weight REAL
)
LANGUAGE sql
AS $$
  SELECT 
    category,
    COUNT(*) as count_total,
    COUNT(*) FILTER (WHERE is_active = true) as count_active,
    AVG(weight)::REAL as avg_weight,
    MAX(weight)::REAL as max_weight,
    MIN(weight)::REAL as min_weight
  FROM keyword_library
  GROUP BY category
  ORDER BY category;
$$;

-- 6. 授权函数给认证用户
GRANT EXECUTE ON FUNCTION calculate_keyword_boost TO authenticated;
GRANT EXECUTE ON FUNCTION search_candidates_with_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_with_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION add_keyword_to_library TO authenticated;
GRANT EXECUTE ON FUNCTION get_keyword_library_stats TO authenticated;

-- 7. 为关键词库函数添加注释
COMMENT ON FUNCTION calculate_keyword_boost IS '计算基于关键词库的分数提升';
COMMENT ON FUNCTION search_candidates_with_keywords IS '集成关键词库的增强候选人搜索函数';
COMMENT ON FUNCTION search_jobs_with_keywords IS '集成关键词库的增强职位搜索函数';
COMMENT ON FUNCTION add_keyword_to_library IS '向关键词库添加新关键词';
COMMENT ON FUNCTION get_keyword_library_stats IS '获取关键词库统计信息'; 