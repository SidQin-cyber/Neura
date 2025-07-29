-- 增强搜索算法优化
-- Migration: Enhanced Hybrid Search Algorithm with Dynamic Alpha
-- Created: 2025-01-27
-- 实现: Single Vector + Dynamic Alpha + Keyword Hit Elevation

-- 1. 创建动态权重计算函数
CREATE OR REPLACE FUNCTION calculate_dynamic_alpha(
  query_text TEXT,
  similarity_score REAL,
  fts_score REAL,
  exact_keyword_matches INTEGER DEFAULT 0
)
RETURNS REAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_alpha REAL := 0.65; -- 基础权重: 65%向量 + 35%FTS
  query_length INTEGER;
  word_count INTEGER;
  has_special_chars BOOLEAN;
  alpha_adjustment REAL := 0.0;
  final_alpha REAL;
BEGIN
  -- 计算查询特征
  query_length := length(trim(query_text));
  word_count := array_length(string_to_array(trim(query_text), ' '), 1);
  has_special_chars := query_text ~ '[+#@.-]';
  
  -- 动态调整规则
  
  -- 规则1: 短查询 (≤5字符) -> 更信任FTS
  IF query_length <= 5 THEN
    alpha_adjustment := alpha_adjustment - 0.15;
  END IF;
  
  -- 规则2: 长查询 (≥20字符) -> 更信任向量
  IF query_length >= 20 THEN
    alpha_adjustment := alpha_adjustment + 0.10;
  END IF;
  
  -- 规则3: 多词查询 (≥4个词) -> 稍微偏向FTS
  IF word_count >= 4 THEN
    alpha_adjustment := alpha_adjustment - 0.05;
  END IF;
  
  -- 规则4: 包含特殊字符 (技术术语) -> 更信任FTS
  IF has_special_chars THEN
    alpha_adjustment := alpha_adjustment - 0.10;
  END IF;
  
  -- 规则5: 精确关键词匹配奖励
  IF exact_keyword_matches > 0 THEN
    alpha_adjustment := alpha_adjustment - (exact_keyword_matches * 0.05);
  END IF;
  
  -- 规则6: 向量分数过低时 (< 0.3) -> 更依赖FTS
  IF similarity_score < 0.3 THEN
    alpha_adjustment := alpha_adjustment - 0.20;
  END IF;
  
  -- 规则7: FTS分数极低时 (< 0.01) -> 完全依赖向量
  IF fts_score < 0.01 THEN
    alpha_adjustment := alpha_adjustment + 0.25;
  END IF;
  
  -- 计算最终权重，确保在 [0.2, 0.8] 范围内
  final_alpha := base_alpha + alpha_adjustment;
  final_alpha := GREATEST(0.2, LEAST(0.8, final_alpha));
  
  RETURN final_alpha;
END;
$$;

-- 2. 创建关键词精确匹配检测函数
CREATE OR REPLACE FUNCTION count_exact_keyword_matches(
  query_text TEXT,
  candidate_name TEXT,
  candidate_title TEXT,
  candidate_company TEXT,
  candidate_skills TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  query_words TEXT[];
  word TEXT;
  match_count INTEGER := 0;
  candidate_text TEXT;
BEGIN
  -- 将查询分词并清理
  query_words := string_to_array(lower(trim(query_text)), ' ');
  
  -- 构建候选人全文本（用于匹配）
  candidate_text := lower(
    COALESCE(candidate_name, '') || ' ' ||
    COALESCE(candidate_title, '') || ' ' ||
    COALESCE(candidate_company, '') || ' ' ||
    COALESCE(array_to_string(candidate_skills, ' '), '')
  );
  
  -- 统计精确匹配的关键词数量
  FOREACH word IN ARRAY query_words
  LOOP
    -- 只计算有意义的词（长度≥2，非常见词）
    IF length(word) >= 2 AND word NOT IN ('的', '和', '与', '及', '或', '在', '有', '是', '了', '中', 'for', 'and', 'or', 'in', 'at', 'to', 'the', 'a', 'an') THEN
      IF position(word IN candidate_text) > 0 THEN
        match_count := match_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN match_count;
END;
$$;

-- 3. 创建增强的候选人搜索函数
CREATE OR REPLACE FUNCTION search_candidates_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
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
  -- 评分细节 (用于调试和优化)
  similarity            REAL,     -- 原始向量相似度
  fts_rank              REAL,     -- 原始FTS分数
  exact_matches         INTEGER,  -- 精确关键词匹配数
  dynamic_alpha         REAL,     -- 动态计算的权重
  raw_combined_score    REAL,     -- 原始组合分数
  boosted_score         REAL,     -- 关键词提升后分数
  final_score           REAL      -- 最终排序分数
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
  boost_factor REAL := 1.2; -- 关键词匹配提升系数
BEGIN
  -- 转换查询向量
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
  RETURN QUERY
  WITH enhanced_results AS (
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
      
      -- 精确关键词匹配检测
      count_exact_keyword_matches(
        query_text, 
        r.name, 
        r.current_title, 
        r.current_company, 
        r.skills
      ) AS exact_keyword_matches
      
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
      -- 动态计算Alpha权重
      calculate_dynamic_alpha(
        query_text,
        similarity_score,
        fts_score,
        exact_keyword_matches
      ) AS dynamic_alpha_weight
    FROM enhanced_results
  ),
  final_results AS (
    SELECT 
      *,
      -- 原始组合分数
      (dynamic_alpha_weight * similarity_score + 
       (1 - dynamic_alpha_weight) * fts_score)::REAL AS raw_combined,
      
      -- 关键词匹配提升
      CASE 
        WHEN exact_keyword_matches > 0 
        THEN (dynamic_alpha_weight * similarity_score + 
              (1 - dynamic_alpha_weight) * fts_score) * 
             (1 + (exact_keyword_matches * (boost_factor - 1) / 5))::REAL
        ELSE (dynamic_alpha_weight * similarity_score + 
              (1 - dynamic_alpha_weight) * fts_score)::REAL
      END AS boosted_combined
    FROM scored_results
  )
  SELECT 
    f.id,
    f.name,
    f.email,
    f.phone,
    f.current_title,
    f.current_company,
    f.location,
    f.years_of_experience,
    f.expected_salary_min,
    f.expected_salary_max,
    f.skills,
    f.education,
    f.experience,
    f.certifications,
    f.languages,
    f.status,
    f.similarity_score,
    f.fts_score,
    f.exact_keyword_matches,
    f.dynamic_alpha_weight,
    f.raw_combined,
    f.boosted_combined,
    -- 最终分数就是提升后的分数
    f.boosted_combined AS final_result_score
  FROM final_results f
  ORDER BY f.boosted_combined DESC
  LIMIT match_count;
END;
$$;

-- 4. 创建增强的职位搜索函数 (结构类似)
CREATE OR REPLACE FUNCTION search_jobs_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active'
)
RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  company             TEXT,
  location            TEXT,
  employment_type     TEXT,
  salary_min          INT,
  salary_max          INT,
  currency            TEXT,
  description         TEXT,
  requirements        TEXT,
  benefits            TEXT,
  skills_required     TEXT[],
  experience_required INT,
  education_required  TEXT,
  industry            TEXT,
  department          TEXT,
  status              TEXT,
  -- 评分细节
  similarity          REAL,
  fts_rank            REAL,
  exact_matches       INTEGER,
  dynamic_alpha       REAL,
  raw_combined_score  REAL,
  boosted_score       REAL,
  final_score         REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
  boost_factor REAL := 1.2;
BEGIN
  query_vec := query_embedding::VECTOR(1536);
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
  RETURN QUERY
  WITH enhanced_results AS (
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
      
      (1 - (j.embedding <=> query_vec))::REAL AS similarity_score,
      ts_rank(j.fts_document, query_tsquery)::REAL AS fts_score,
      
      -- 职位的关键词匹配 (使用不同的字段)
      count_exact_keyword_matches(
        query_text, 
        j.title, 
        j.company, 
        j.industry, 
        j.skills_required
      ) AS exact_keyword_matches
      
    FROM jobs j
    WHERE 
      j.status = status_filter
      AND smart_location_match(j.location, location_filter)
      AND (experience_min IS NULL OR j.experience_required >= experience_min)
      AND (experience_max IS NULL OR j.experience_required <= experience_max)
      AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
      AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
      AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
      AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
           OR j.fts_document @@ query_tsquery)
  ),
  scored_results AS (
    SELECT 
      *,
      calculate_dynamic_alpha(
        query_text,
        similarity_score,
        fts_score,
        exact_keyword_matches
      ) AS dynamic_alpha_weight
    FROM enhanced_results
  ),
  final_results AS (
    SELECT 
      *,
      (dynamic_alpha_weight * similarity_score + 
       (1 - dynamic_alpha_weight) * fts_score)::REAL AS raw_combined,
      
      CASE 
        WHEN exact_keyword_matches > 0 
        THEN (dynamic_alpha_weight * similarity_score + 
              (1 - dynamic_alpha_weight) * fts_score) * 
             (1 + (exact_keyword_matches * (boost_factor - 1) / 5))::REAL
        ELSE (dynamic_alpha_weight * similarity_score + 
              (1 - dynamic_alpha_weight) * fts_score)::REAL
      END AS boosted_combined
    FROM scored_results
  )
  SELECT 
    f.id,
    f.title,
    f.company,
    f.location,
    f.employment_type,
    f.salary_min,
    f.salary_max,
    f.currency,
    f.description,
    f.requirements,
    f.benefits,
    f.skills_required,
    f.experience_required,
    f.education_required,
    f.industry,
    f.department,
    f.status,
    f.similarity_score,
    f.fts_score,
    f.exact_keyword_matches,
    f.dynamic_alpha_weight,
    f.raw_combined,
    f.boosted_combined,
    f.boosted_combined AS final_result_score
  FROM final_results f
  ORDER BY f.boosted_combined DESC
  LIMIT match_count;
END;
$$;

-- 5. 为新函数设置权限
GRANT EXECUTE ON FUNCTION calculate_dynamic_alpha TO authenticated;
GRANT EXECUTE ON FUNCTION count_exact_keyword_matches TO authenticated;
GRANT EXECUTE ON FUNCTION search_candidates_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_enhanced TO authenticated;

-- 6. 添加函数说明注释
COMMENT ON FUNCTION calculate_dynamic_alpha IS '动态计算混合搜索的Alpha权重，基于查询特征自动调整向量vs FTS的权重比例';
COMMENT ON FUNCTION count_exact_keyword_matches IS '统计查询中精确匹配的关键词数量，用于搜索结果提升';
COMMENT ON FUNCTION search_candidates_enhanced IS '增强版候选人搜索函数，支持动态权重调整和关键词匹配提升';
COMMENT ON FUNCTION search_jobs_enhanced IS '增强版职位搜索函数，支持动态权重调整和关键词匹配提升';

-- 7. 创建性能监控视图（可选）
CREATE OR REPLACE VIEW search_performance_stats AS
SELECT 
  'enhanced_search' as algorithm_version,
  COUNT(*) as total_candidates,
  AVG(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as embedding_coverage,
  AVG(CASE WHEN fts_document IS NOT NULL THEN 1 ELSE 0 END) as fts_coverage
FROM resumes 
WHERE status = 'active';

COMMENT ON VIEW search_performance_stats IS '搜索算法性能统计，用于监控优化效果'; 