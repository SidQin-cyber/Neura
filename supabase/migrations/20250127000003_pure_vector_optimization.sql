-- 纯向量语义优化方案
-- Migration: Pure Vector Semantic Optimization
-- Created: 2025-01-27
-- 策略: 移除硬编码同义词，依赖向量语义相似性，优化召回率

-- 1. 移除之前的硬编码同义词函数
DROP FUNCTION IF EXISTS expand_query_synonyms(TEXT);

-- 2. 创建简化的增强搜索函数 - 纯向量语义方案
CREATE OR REPLACE FUNCTION search_candidates_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT -1.0,  -- 极低阈值，依赖排序质量
  match_count          INT    DEFAULT 20,    -- 增加返回数量
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
  WITH 
  -- 1. 向量搜索 - 依赖OpenAI embedding的语义理解
  vector_candidates AS (
    SELECT 
      r.*,
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
  
  -- 2. FTS搜索 - 处理精确关键词匹配
  fts_candidates AS (
    SELECT 
      r.*,
      0.0 AS similarity_score,
      ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32) AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
    ORDER BY fts_score DESC
    LIMIT match_count
  ),
  
  -- 3. 合并去重 - 保留最佳分数
  all_candidates AS (
    SELECT * FROM vector_candidates
    UNION ALL
    SELECT * FROM fts_candidates
  ),
  
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
  
  -- 4. 计算增强指标
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
  
  -- 5. 最终评分 - 重点提升向量权重
  final_results AS (
    SELECT 
      er.*,
      -- 提升向量权重，确保语义相似性占主导
      (er.dynamic_alpha * er.similarity + (1.0 - er.dynamic_alpha) * er.fts_rank) as raw_combined_score
    FROM enhanced_results er
  ),
  
  -- 6. 关键词精确匹配提升
  boosted_results AS (
    SELECT 
      fr.*,
      CASE 
        WHEN fr.exact_matches > 0 THEN fr.raw_combined_score * (1.0 + (fr.exact_matches * 0.05))
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

-- 3. 优化注释
COMMENT ON FUNCTION search_candidates_enhanced IS '
纯向量语义优化版本
- 默认阈值: -1.0 (确保高召回率)
- 返回数量: 20个候选人
- 同义词处理: 依赖OpenAI embedding语义理解
- 排序优化: 动态Alpha + 关键词提升
- 维护成本: 零（无需维护同义词词典）
';

-- 4. 性能优化建议
-- 如果向量搜索性能不足，可以考虑重建向量索引：
-- DROP INDEX IF EXISTS idx_resumes_embedding;
-- CREATE INDEX idx_resumes_embedding ON resumes USING hnsw (embedding vector_cosine_ops); 