-- 回滚到84.7%召回率版本
-- Migration: Rollback to 84.7% Recall Version
-- Created: 2025-01-27
-- 策略: 恢复同义词扩展 + UNION ALL架构

-- 1. 恢复同义词扩展函数
CREATE OR REPLACE FUNCTION expand_query_synonyms(query_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  expanded_query TEXT;
BEGIN
  expanded_query := query_text;
  
  -- AI相关同义词扩展
  expanded_query := regexp_replace(expanded_query, '\y人工智能\y', '人工智能|AI|机器学习|算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yAI\y', 'AI|人工智能|机器学习|算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y深度学习\y', '深度学习|deeplearning|神经网络', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y机器学习\y', '机器学习|machinelearning|ML|算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y计算机视觉\y', '计算机视觉|CV|图像识别|opencv', 'gi');
  
  -- 技术栈同义词扩展
  expanded_query := regexp_replace(expanded_query, '\yReact\y', 'React|ReactJS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yVue\y', 'Vue|VueJS|Vue.js', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yJavaScript\y', 'JavaScript|JS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yTypeScript\y', 'TypeScript|TS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yNode.js\y', 'Node.js|NodeJS|Node', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yAngular\y', 'Angular|AngularJS', 'gi');
  
  -- 后端技术栈
  expanded_query := regexp_replace(expanded_query, '\yJava\y', 'Java|Spring|SpringBoot', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yPython\y', 'Python|Django|Flask|FastAPI', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yGo\y', 'Go|Golang', 'gi');
  
  -- 职位相关
  expanded_query := regexp_replace(expanded_query, '\y前端\y', '前端|frontend|web开发', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y后端\y', '后端|backend|服务端', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y全栈\y', '全栈|fullstack|full-stack', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y架构师\y', '架构师|architect|技术架构', 'gi');
  
  RETURN expanded_query;
END;
$$;

-- 2. 恢复UNION ALL架构的search_candidates_enhanced函数
CREATE OR REPLACE FUNCTION search_candidates_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT -1.0,  -- 保持低阈值
  match_count          INT    DEFAULT 20,    -- 保持20个结果
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active'
)
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  email                TEXT,
  phone                TEXT,
  current_title        TEXT,
  current_company      TEXT,
  location             TEXT,
  years_of_experience  INTEGER,
  expected_salary_min  INTEGER,
  expected_salary_max  INTEGER,
  skills               TEXT[],
  education            JSONB,
  experience           JSONB,
  certifications       JSONB,
  languages            JSONB,
  status               TEXT,
  similarity           REAL,
  fts_rank             REAL,
  exact_matches        INTEGER,
  dynamic_alpha        REAL,
  raw_combined_score   REAL,
  boosted_score        REAL,
  final_score          REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  expanded_query TEXT;
BEGIN
  -- 扩展查询同义词
  expanded_query := expand_query_synonyms(query_text);
  
  RETURN QUERY
  WITH 
  -- 1. 向量搜索结果（更宽松的阈值）
  vector_candidates AS (
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
      (1.0 - (r.embedding <-> query_embedding::vector)) AS similarity_score,
      0.0 AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND (1.0 - (r.embedding <-> query_embedding::vector)) >= similarity_threshold
    ORDER BY r.embedding <-> query_embedding::vector
    LIMIT match_count
  ),
  
  -- 2. FTS搜索结果（包含原始查询和扩展查询）
  fts_candidates AS (
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
      0.0 AS similarity_score,
      GREATEST(
        ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32),
        ts_rank_cd(r.fts_document, to_tsquery('chinese_zh', 
          regexp_replace(expanded_query, '\s+', '|', 'g')
        ), 32)
      ) AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND (
        r.fts_document @@ plainto_tsquery('chinese_zh', query_text) OR
        r.fts_document @@ to_tsquery('chinese_zh', 
          regexp_replace(expanded_query, '\s+', '|', 'g')
        )
      )
    ORDER BY fts_score DESC
    LIMIT match_count
  ),
  
  -- 3. 合并去重结果
  all_candidates AS (
    SELECT * FROM vector_candidates
    UNION ALL
    SELECT * FROM fts_candidates
  ),
  
  -- 4. 按ID去重，保留最高分数
  deduplicated AS (
    SELECT 
      id, name, email, phone, current_title, current_company, location,
      years_of_experience, expected_salary_min, expected_salary_max,
      skills, education, experience, certifications, languages, status,
      MAX(similarity_score) as similarity,
      MAX(fts_score) as fts_rank
    FROM all_candidates
    GROUP BY id, name, email, phone, current_title, current_company, location,
             years_of_experience, expected_salary_min, expected_salary_max,
             skills, education, experience, certifications, languages, status
  ),
  
  -- 5. 计算增强指标
  enhanced_results AS (
    SELECT 
      d.*,
      count_exact_keyword_matches(query_text, 
        COALESCE(d.skills::text, '') || ' ' || 
        COALESCE(d.current_title, '') || ' ' || 
        COALESCE(d.current_company, '')
      ) as exact_matches,
      calculate_dynamic_alpha(query_text, d.similarity, d.fts_rank, 
        count_exact_keyword_matches(query_text, 
          COALESCE(d.skills::text, '') || ' ' || 
          COALESCE(d.current_title, '') || ' ' || 
          COALESCE(d.current_company, '')
        )
      ) as dynamic_alpha
    FROM deduplicated d
  ),
  
  -- 6. 计算最终分数
  final_results AS (
    SELECT 
      er.*,
      (er.dynamic_alpha * er.similarity + (1.0 - er.dynamic_alpha) * er.fts_rank) as raw_combined_score
    FROM enhanced_results er
  ),
  
  -- 7. 关键词提升（保持原有的4%提升）
  boosted_results AS (
    SELECT 
      fr.*,
      CASE 
        WHEN fr.exact_matches > 0 THEN fr.raw_combined_score * (1.0 + (fr.exact_matches * 0.04))
        ELSE fr.raw_combined_score
      END as boosted_score
    FROM final_results fr
  )
  
  SELECT 
    br.id, br.name, br.email, br.phone, br.current_title, br.current_company,
    br.location, br.years_of_experience, br.expected_salary_min, br.expected_salary_max,
    br.skills, br.education, br.experience, br.certifications, br.languages, br.status,
    br.similarity::REAL, br.fts_rank::REAL, br.exact_matches, br.dynamic_alpha::REAL,
    br.raw_combined_score::REAL, br.boosted_score::REAL, br.boosted_score::REAL as final_score
  FROM boosted_results br
  ORDER BY br.boosted_score DESC, br.similarity DESC, br.fts_rank DESC
  LIMIT match_count;
  
END;
$$;

-- 3. 添加函数注释
COMMENT ON FUNCTION search_candidates_enhanced IS '回滚到84.7%召回率版本 - 同义词扩展 + UNION ALL架构 + 4%关键词提升';
COMMENT ON FUNCTION expand_query_synonyms IS '查询同义词扩展函数 - 解决AI、技术栈等关键词不匹配问题';

-- 验证回滚
SELECT '成功回滚到84.7%召回率版本' as status; 