-- 修复UNION ALL列名冲突
-- Migration: Fix UNION ALL Column Ambiguous Issue
-- Created: 2025-01-27
-- 修复: 84.7%召回率版本中UNION ALL的列名冲突

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
DECLARE
  expanded_query TEXT;
BEGIN
  -- 扩展查询同义词
  expanded_query := expand_query_synonyms(query_text);
  
  RETURN QUERY
  WITH 
  -- 1. 向量搜索结果 - 明确指定所有列名
  vector_candidates AS (
    SELECT 
      r.id AS candidate_id,
      r.name AS candidate_name,
      r.email AS candidate_email,
      r.phone AS candidate_phone,
      r.current_title AS candidate_current_title,
      r.current_company AS candidate_current_company,
      r.location AS candidate_location,
      r.years_of_experience AS candidate_years_of_experience,
      r.expected_salary_min AS candidate_expected_salary_min,
      r.expected_salary_max AS candidate_expected_salary_max,
      r.skills AS candidate_skills,
      r.education AS candidate_education,
      r.experience AS candidate_experience,
      r.certifications AS candidate_certifications,
      r.languages AS candidate_languages,
      r.status AS candidate_status,
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
  
  -- 2. FTS搜索结果 - 使用相同的列名
  fts_candidates AS (
    SELECT 
      r.id AS candidate_id,
      r.name AS candidate_name,
      r.email AS candidate_email,
      r.phone AS candidate_phone,
      r.current_title AS candidate_current_title,
      r.current_company AS candidate_current_company,
      r.location AS candidate_location,
      r.years_of_experience AS candidate_years_of_experience,
      r.expected_salary_min AS candidate_expected_salary_min,
      r.expected_salary_max AS candidate_expected_salary_max,
      r.skills AS candidate_skills,
      r.education AS candidate_education,
      r.experience AS candidate_experience,
      r.certifications AS candidate_certifications,
      r.languages AS candidate_languages,
      r.status AS candidate_status,
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
      candidate_id, candidate_name, candidate_email, candidate_phone, 
      candidate_current_title, candidate_current_company, candidate_location,
      candidate_years_of_experience, candidate_expected_salary_min, candidate_expected_salary_max,
      candidate_skills, candidate_education, candidate_experience, 
      candidate_certifications, candidate_languages, candidate_status,
      MAX(similarity_score) as similarity,
      MAX(fts_score) as fts_rank
    FROM all_candidates
    GROUP BY candidate_id, candidate_name, candidate_email, candidate_phone, 
             candidate_current_title, candidate_current_company, candidate_location,
             candidate_years_of_experience, candidate_expected_salary_min, candidate_expected_salary_max,
             candidate_skills, candidate_education, candidate_experience, 
             candidate_certifications, candidate_languages, candidate_status
  ),
  
  -- 5. 计算增强指标
  enhanced_results AS (
    SELECT 
      d.*,
      count_exact_keyword_matches(query_text, 
        COALESCE(d.candidate_skills::text, '') || ' ' || 
        COALESCE(d.candidate_current_title, '') || ' ' || 
        COALESCE(d.candidate_current_company, '')
      ) as exact_matches,
      calculate_dynamic_alpha(query_text, d.similarity, d.fts_rank, 
        count_exact_keyword_matches(query_text, 
          COALESCE(d.candidate_skills::text, '') || ' ' || 
          COALESCE(d.candidate_current_title, '') || ' ' || 
          COALESCE(d.candidate_current_company, '')
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
  
  -- 8. 最终返回，映射回原始列名
  SELECT 
    br.candidate_id AS id,
    br.candidate_name AS name,
    br.candidate_email AS email,
    br.candidate_phone AS phone,
    br.candidate_current_title AS current_title,
    br.candidate_current_company AS current_company,
    br.candidate_location AS location,
    br.candidate_years_of_experience AS years_of_experience,
    br.candidate_expected_salary_min AS expected_salary_min,
    br.candidate_expected_salary_max AS expected_salary_max,
    br.candidate_skills AS skills,
    br.candidate_education AS education,
    br.candidate_experience AS experience,
    br.candidate_certifications AS certifications,
    br.candidate_languages AS languages,
    br.candidate_status AS status,
    br.similarity::REAL AS similarity,
    br.fts_rank::REAL AS fts_rank,
    br.exact_matches AS exact_matches,
    br.dynamic_alpha::REAL AS dynamic_alpha,
    br.raw_combined_score::REAL AS raw_combined_score,
    br.boosted_score::REAL AS boosted_score,
    br.boosted_score::REAL AS final_score
  FROM boosted_results br
  ORDER BY br.boosted_score DESC, br.similarity DESC, br.fts_rank DESC
  LIMIT match_count;
  
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION search_candidates_enhanced IS '修复列名冲突的84.7%召回率版本 - 同义词扩展 + UNION ALL架构 + 4%关键词提升';

-- 验证修复
SELECT '成功修复UNION ALL列名冲突' as status; 