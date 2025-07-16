-- =========================================
-- 更新search_candidates_rpc函数以支持新的增强字段
-- 包含summary, relocation_preferences, projects
-- 并构建丰富的full_text_content供rerank使用
-- =========================================

-- 更新候选人混合搜索函数
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding     TEXT,
  query_text          TEXT,          -- 原始关键词
  similarity_threshold FLOAT  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id              UUID   DEFAULT NULL,
  fts_weight           FLOAT  DEFAULT 0.4,
  vector_weight        FLOAT  DEFAULT 0.6
)
RETURNS TABLE (
  id                 UUID,
  name               TEXT,
  email              TEXT,
  phone              TEXT,
  current_title      TEXT,
  current_company    TEXT,
  location           TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills             TEXT[],
  education          JSONB,
  experience         JSONB,
  certifications     JSONB,
  languages          JSONB,
  -- 新增字段
  summary            TEXT,
  relocation_preferences TEXT[],
  projects           JSONB,
  -- 
  status             TEXT,
  similarity         FLOAT,
  fts_rank           FLOAT,
  combined_score     FLOAT,
  -- 🔥 新增：为rerank构建的丰富文本内容
  full_text_content  TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
  RETURN QUERY
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
    -- 新增字段
    r.summary,
    r.relocation_preferences,
    r.projects,
    --
    r.status,
    (1 - (r.embedding <=> query_vec))                 AS similarity,
    ts_rank(r.fts_document, query_tsquery)            AS fts_rank,
    ((1 - (r.embedding <=> query_vec)) * vector_weight +
      ts_rank(r.fts_document, query_tsquery) * fts_weight)::FLOAT AS combined_score,
    
    -- 🔥 构建丰富的full_text_content，专为rerank优化
    CONCAT_WS(E'\n',
      -- 基本信息
      COALESCE('姓名: ' || r.name, ''),
      COALESCE('职位: ' || r.current_title, ''),
      COALESCE('公司: ' || r.current_company, ''),
      COALESCE('地点: ' || r.location, ''),
      CASE 
        WHEN r.relocation_preferences IS NOT NULL AND array_length(r.relocation_preferences, 1) > 0 
        THEN '期望工作地: ' || array_to_string(r.relocation_preferences, ', ')
        ELSE ''
      END,
      
      -- 个人简介（这是rerank的核心！）
      CASE 
        WHEN r.summary IS NOT NULL AND length(trim(r.summary)) > 0 
        THEN E'\n个人简介:\n' || r.summary
        ELSE ''
      END,
      
      -- 技能列表
      CASE 
        WHEN r.skills IS NOT NULL AND array_length(r.skills, 1) > 0 
        THEN E'\n主要技能:\n' || array_to_string(r.skills, ', ')
        ELSE ''
      END,
      
      -- 工作经历（提取关键信息）
      CASE 
        WHEN r.experience IS NOT NULL 
        THEN E'\n工作经历:\n' || (
          SELECT string_agg(
            COALESCE(exp->>'company', '') || ' - ' || 
            COALESCE(exp->>'title', '') || ': ' ||
            COALESCE(array_to_string(ARRAY(SELECT jsonb_array_elements_text(exp->'description')), ' '), ''),
            E'\n'
          )
          FROM jsonb_array_elements(r.experience) exp
          WHERE exp IS NOT NULL
        )
        ELSE ''
      END,
      
      -- 项目经验
      CASE 
        WHEN r.projects IS NOT NULL 
        THEN E'\n项目经验:\n' || (
          SELECT string_agg(
            COALESCE(proj->>'name', '') || ': ' || 
            COALESCE(proj->>'description', '') || 
            CASE 
              WHEN proj->'tech_stack' IS NOT NULL 
              THEN ' (技术栈: ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(proj->'tech_stack')), ', ') || ')'
              ELSE ''
            END,
            E'\n'
          )
          FROM jsonb_array_elements(r.projects) proj
          WHERE proj IS NOT NULL
        )
        ELSE ''
      END,
      
      -- 教育背景
      CASE 
        WHEN r.education IS NOT NULL 
        THEN E'\n教育背景:\n' || (
          SELECT string_agg(
            COALESCE(edu->>'school', '') || ' ' || 
            COALESCE(edu->>'degree', '') || ' ' ||
            COALESCE(edu->>'field_of_study', ''),
            ', '
          )
          FROM jsonb_array_elements(r.education) edu
          WHERE edu IS NOT NULL
        )
        ELSE ''
      END
    ) AS full_text_content
    
  FROM resumes r
  WHERE 
    r.status = status_filter
    AND (user_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR r.skills && skills_filter)
    -- 向量或关键词满足其一即可
    AND ((1 - (r.embedding <=> query_vec)) >= similarity_threshold
         OR r.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 验证函数更新成功
SELECT 'search_candidates_rpc函数已更新，现在包含summary, relocation_preferences, projects字段以及full_text_content构建逻辑' AS status; 