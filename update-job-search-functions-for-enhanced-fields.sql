-- =========================================
-- 更新search_jobs_rpc函数以支持新的增强字段
-- 包含job_summary, team_info, growth_opportunities等
-- 并构建丰富的full_text_content供rerank使用
-- =========================================

-- 更新岗位混合搜索函数
CREATE OR REPLACE FUNCTION search_jobs_rpc(
  query_embedding     TEXT,
  query_text          TEXT,          -- 原始关键词
  similarity_threshold FLOAT  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id              UUID   DEFAULT NULL,
  urgency_filter       TEXT   DEFAULT NULL,  -- 新增：紧急程度筛选
  remote_policy_filter TEXT   DEFAULT NULL,  -- 新增：远程工作筛选
  fts_weight           FLOAT  DEFAULT 0.4,
  vector_weight        FLOAT  DEFAULT 0.6
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  company              TEXT,
  location             TEXT,
  employment_type      TEXT,
  salary_min           INT,
  salary_max           INT,
  currency             TEXT,
  description          TEXT,
  requirements         TEXT,
  benefits             TEXT,
  skills_required      TEXT[],
  experience_required  INT,
  education_required   TEXT,
  industry             TEXT,
  department           TEXT,
  -- 新增字段
  job_summary          TEXT,
  team_info            JSONB,
  growth_opportunities TEXT[],
  work_environment     TEXT,
  company_culture      TEXT,
  remote_policy        TEXT,
  interview_process    JSONB,
  contact_info         JSONB,
  urgency_level        TEXT,
  expected_start_date  DATE,
  --
  status               TEXT,
  similarity           FLOAT,
  fts_rank             FLOAT,
  combined_score       FLOAT,
  -- 🔥 新增：为rerank构建的丰富文本内容
  full_text_content    TEXT
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
    -- 新增字段
    j.job_summary,
    j.team_info,
    j.growth_opportunities,
    j.work_environment,
    j.company_culture,
    j.remote_policy,
    j.interview_process,
    j.contact_info,
    j.urgency_level,
    j.expected_start_date,
    --
    j.status,
    (1 - (j.embedding <=> query_vec))                 AS similarity,
    ts_rank(j.fts_document, query_tsquery)            AS fts_rank,
    ((1 - (j.embedding <=> query_vec)) * vector_weight +
      ts_rank(j.fts_document, query_tsquery) * fts_weight)::FLOAT AS combined_score,
    
    -- 🔥 构建丰富的full_text_content，专为rerank优化
    CONCAT_WS(E'\n',
      -- 基本岗位信息
      COALESCE('职位: ' || j.title, ''),
      COALESCE('公司: ' || j.company, ''),
      COALESCE('地点: ' || j.location, ''),
      COALESCE('类型: ' || j.employment_type, ''),
      CASE 
        WHEN j.salary_min IS NOT NULL AND j.salary_max IS NOT NULL 
        THEN '薪资: ' || j.salary_min || '-' || j.salary_max || ' ' || COALESCE(j.currency, 'CNY')
        ELSE ''
      END,
      COALESCE('部门: ' || j.department, ''),
      COALESCE('行业: ' || j.industry, ''),
      
      -- 岗位亮点总结（这是rerank的核心！）
      CASE 
        WHEN j.job_summary IS NOT NULL AND length(trim(j.job_summary)) > 0 
        THEN E'\n岗位亮点:\n' || j.job_summary
        ELSE ''
      END,
      
      -- 技能要求
      CASE 
        WHEN j.skills_required IS NOT NULL AND array_length(j.skills_required, 1) > 0 
        THEN E'\n技能要求:\n' || array_to_string(j.skills_required, ', ')
        ELSE ''
      END,
      
      -- 岗位描述
      CASE 
        WHEN j.description IS NOT NULL AND length(trim(j.description)) > 0 
        THEN E'\n岗位描述:\n' || j.description
        ELSE ''
      END,
      
      -- 任职要求
      CASE 
        WHEN j.requirements IS NOT NULL AND length(trim(j.requirements)) > 0 
        THEN E'\n任职要求:\n' || j.requirements
        ELSE ''
      END,
      
      -- 团队信息
      CASE 
        WHEN j.team_info IS NOT NULL 
        THEN E'\n团队信息:\n' || (
          SELECT string_agg(
            CASE 
              WHEN info.key = 'size' THEN '团队规模: ' || (info.value->>0)
              WHEN info.key = 'lead_background' THEN '团队Leader: ' || (info.value->>0)
              WHEN info.key = 'team_culture' THEN '团队文化: ' || (info.value->>0)
              WHEN info.key = 'tech_stack' THEN '技术栈: ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(info.value)), ', ')
              ELSE info.key || ': ' || (info.value->>0)
            END,
            E'\n'
          )
          FROM jsonb_each(j.team_info) info
          WHERE info.value IS NOT NULL
        )
        ELSE ''
      END,
      
      -- 成长机会
      CASE 
        WHEN j.growth_opportunities IS NOT NULL AND array_length(j.growth_opportunities, 1) > 0 
        THEN E'\n成长机会:\n' || array_to_string(j.growth_opportunities, E'\n- ')
        ELSE ''
      END,
      
      -- 工作环境
      CASE 
        WHEN j.work_environment IS NOT NULL AND length(trim(j.work_environment)) > 0 
        THEN E'\n工作环境:\n' || j.work_environment
        ELSE ''
      END,
      
      -- 公司文化
      CASE 
        WHEN j.company_culture IS NOT NULL AND length(trim(j.company_culture)) > 0 
        THEN E'\n公司文化:\n' || j.company_culture
        ELSE ''
      END,
      
      -- 远程工作政策
      CASE 
        WHEN j.remote_policy IS NOT NULL AND length(trim(j.remote_policy)) > 0 
        THEN E'\n工作模式:\n' || j.remote_policy
        ELSE ''
      END,
      
      -- 福利待遇
      CASE 
        WHEN j.benefits IS NOT NULL AND length(trim(j.benefits)) > 0 
        THEN E'\n福利待遇:\n' || j.benefits
        ELSE ''
      END,
      
      -- 面试流程
      CASE 
        WHEN j.interview_process IS NOT NULL 
        THEN E'\n面试流程:\n' || (
          SELECT string_agg(
            CASE 
              WHEN proc.key = 'rounds' THEN '面试轮次: ' || (proc.value->>0)
              WHEN proc.key = 'duration' THEN '预计时长: ' || (proc.value->>0)
              WHEN proc.key = 'format' THEN '面试形式: ' || (proc.value->>0)
              WHEN proc.key = 'preparation' THEN '准备建议: ' || (proc.value->>0)
              ELSE proc.key || ': ' || (proc.value->>0)
            END,
            E'\n'
          )
          FROM jsonb_each(j.interview_process) proc
          WHERE proc.value IS NOT NULL
        )
        ELSE ''
      END
    ) AS full_text_content
    
  FROM jobs j
  WHERE 
    j.status = status_filter
    AND (user_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
    -- 新增筛选条件
    AND (urgency_filter IS NULL OR j.urgency_level = urgency_filter)
    AND (remote_policy_filter IS NULL OR j.remote_policy ILIKE '%' || remote_policy_filter || '%')
    -- 向量或关键词满足其一即可
    AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
         OR j.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 验证函数更新成功
SELECT 'search_jobs_rpc函数已更新，现在包含job_summary, team_info, growth_opportunities等字段以及full_text_content构建逻辑' AS status; 