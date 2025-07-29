-- 完整修复列名冲突问题
-- Migration: Complete Column Fix for UNION ALL
-- Created: 2025-01-27
-- 彻底解决: UNION ALL中的列名冲突，使用更简化的方法

-- 删除旧函数重新创建
DROP FUNCTION IF EXISTS search_candidates_enhanced(TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION search_candidates_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT -1.0,
  match_count          INT    DEFAULT 20,
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
BEGIN
  RETURN QUERY
  WITH base_search AS (
    -- 统一搜索逻辑，避免UNION ALL
    SELECT DISTINCT
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
      -- 向量相似度计算
      GREATEST(0.0, 1.0 - (r.embedding <-> query_embedding::vector)) AS similarity_score,
      -- FTS分数计算
      CASE 
        WHEN r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
        THEN ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32)
        ELSE 0.0
      END AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND (
        -- 向量搜索条件
        (1.0 - (r.embedding <-> query_embedding::vector)) >= similarity_threshold
        OR 
        -- FTS搜索条件
        r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
      )
  ),
  
  enhanced_results AS (
    SELECT 
      bs.*,
      -- 计算精确关键词匹配
      count_exact_keyword_matches(query_text, 
        COALESCE(bs.skills::text, '') || ' ' || 
        COALESCE(bs.current_title, '') || ' ' || 
        COALESCE(bs.current_company, '')
      ) as exact_keyword_matches,
      -- 计算动态Alpha
      calculate_dynamic_alpha(
        query_text, 
        bs.similarity_score, 
        bs.fts_score,
        count_exact_keyword_matches(query_text, 
          COALESCE(bs.skills::text, '') || ' ' || 
          COALESCE(bs.current_title, '') || ' ' || 
          COALESCE(bs.current_company, '')
        )
      ) as alpha_weight
    FROM base_search bs
  ),
  
  scored_results AS (
    SELECT 
      er.*,
      -- 计算原始组合分数
      (er.alpha_weight * er.similarity_score + (1.0 - er.alpha_weight) * er.fts_score) as raw_score,
      -- 应用关键词提升
      CASE 
        WHEN er.exact_keyword_matches > 0 
        THEN (er.alpha_weight * er.similarity_score + (1.0 - er.alpha_weight) * er.fts_score) * (1.0 + (er.exact_keyword_matches * 0.05))
        ELSE (er.alpha_weight * er.similarity_score + (1.0 - er.alpha_weight) * er.fts_score)
      END as final_ranking_score
    FROM enhanced_results er
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
    sr.similarity_score::REAL AS similarity,
    sr.fts_score::REAL AS fts_rank,
    sr.exact_keyword_matches AS exact_matches,
    sr.alpha_weight::REAL AS dynamic_alpha,
    sr.raw_score::REAL AS raw_combined_score,
    sr.final_ranking_score::REAL AS boosted_score,
    sr.final_ranking_score::REAL AS final_score
  FROM scored_results sr
  ORDER BY sr.final_ranking_score DESC, sr.similarity_score DESC, sr.fts_score DESC
  LIMIT match_count;
  
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION search_candidates_enhanced IS '
纯向量语义优化版本 - 完全修复列名冲突
- 使用统一查询避免UNION ALL冲突
- 默认阈值: -1.0 (确保高召回率)
- 返回数量: 20个候选人
- 同义词处理: 依赖OpenAI embedding语义理解
- 维护成本: 零（无需维护同义词词典）
'; 