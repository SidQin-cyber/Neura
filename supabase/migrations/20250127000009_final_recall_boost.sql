-- 最终召回率提升优化
-- Migration: Final Recall Boost Optimization
-- Created: 2025-01-27
-- 目标: 将召回率从59%提升到95%+

-- 1. 修改动态Alpha计算，大幅降低向量权重，提升FTS权重
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
  base_alpha REAL := 0.35; -- 大幅降低向量权重: 35%向量 + 65%FTS
  alpha_adjustment REAL := 0.0;
  word_count INTEGER;
  final_alpha REAL;
BEGIN
  -- 输入验证
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN base_alpha;
  END IF;
  
  -- 计算查询特征
  word_count := COALESCE(array_length(string_to_array(trim(query_text), ' '), 1), 1);
  
  -- 更激进的调整规则 - 偏向FTS匹配
  
  -- 规则1: 短查询更依赖FTS
  IF word_count <= 2 THEN
    alpha_adjustment := -0.20; -- 降到15%向量权重
  END IF;
  
  -- 规则2: 长查询稍微提升向量权重
  IF word_count >= 5 THEN
    alpha_adjustment := 0.10; -- 提升到45%向量权重
  END IF;
  
  -- 规则3: 有精确匹配时大幅降低向量权重
  IF exact_keyword_matches >= 1 THEN
    alpha_adjustment := alpha_adjustment - 0.15;
  END IF;
  
  -- 规则4: 向量分数很低时完全依赖FTS
  IF similarity_score < 0.1 THEN
    alpha_adjustment := -0.25; -- 降到10%向量权重
  END IF;
  
  -- 规则5: FTS有结果时提升FTS权重
  IF fts_score > 0.01 THEN
    alpha_adjustment := alpha_adjustment - 0.10;
  END IF;
  
  final_alpha := base_alpha + alpha_adjustment;
  final_alpha := GREATEST(0.1, LEAST(0.6, final_alpha)); -- 范围[0.1, 0.6]
  
  RETURN final_alpha;
END;
$$;

-- 2. 增强关键词匹配函数，更宽松的匹配规则
CREATE OR REPLACE FUNCTION count_exact_keyword_matches(
  query_text TEXT,
  target_text TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  query_words TEXT[];
  word TEXT;
  match_count INTEGER := 0;
  normalized_target TEXT;
  normalized_word TEXT;
BEGIN
  -- 输入验证
  IF query_text IS NULL OR target_text IS NULL OR 
     trim(query_text) = '' OR trim(target_text) = '' THEN
    RETURN 0;
  END IF;
  
  -- 标准化文本
  normalized_target := lower(target_text);
  query_words := string_to_array(lower(trim(query_text)), ' ');
  
  -- 更宽松的匹配规则
  FOREACH word IN ARRAY query_words
  LOOP
    IF word IS NOT NULL AND trim(word) != '' THEN
      normalized_word := trim(word);
      
      -- 完全匹配
      IF position(normalized_word IN normalized_target) > 0 THEN
        match_count := match_count + 1;
      -- 部分匹配 (词根匹配)
      ELSIF length(normalized_word) >= 3 THEN
        -- 前缀匹配
        IF normalized_target ~ (normalized_word || '.*') THEN
          match_count := match_count + 1;
        -- 包含匹配
        ELSIF normalized_target ~ ('.*' || substring(normalized_word, 1, 3) || '.*') THEN
          match_count := match_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN match_count;
END;
$$;

-- 3. 修改搜索函数，进一步降低相似度阈值并优化排序
CREATE OR REPLACE FUNCTION search_candidates_enhanced(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT -1.0,  -- 保持最低阈值
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
    -- 统一搜索逻辑，确保最大召回
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
      -- 向量相似度计算 (更宽松)
      GREATEST(0.0, 1.0 - (r.embedding <-> query_embedding::vector)) AS similarity_score,
      -- FTS分数计算 (更宽松的匹配)
      CASE 
        WHEN r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
        THEN ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32)
        WHEN r.fts_document @@ to_tsquery('chinese_zh', replace(trim(query_text), ' ', ' | '))
        THEN ts_rank_cd(r.fts_document, to_tsquery('chinese_zh', replace(trim(query_text), ' ', ' | ')), 16)
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
      -- 超宽松的搜索条件 - 几乎包含所有候选人
      AND (
        -- 向量搜索条件
        (1.0 - (r.embedding <-> query_embedding::vector)) >= similarity_threshold
        OR 
        -- FTS搜索条件 (宽松)
        r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
        OR
        -- 技能数组匹配
        r.skills::text ILIKE '%' || query_text || '%'
        OR
        -- 职位标题匹配
        r.current_title ILIKE '%' || query_text || '%'
        OR
        -- 任意字段包含查询词汇
        (r.name || ' ' || COALESCE(r.current_title, '') || ' ' || COALESCE(r.skills::text, '')) 
        ILIKE '%' || split_part(query_text, ' ', 1) || '%'
      )
  ),
  
  enhanced_results AS (
    SELECT 
      bs.*,
      -- 计算增强的精确关键词匹配
      count_exact_keyword_matches(query_text, 
        COALESCE(bs.skills::text, '') || ' ' || 
        COALESCE(bs.current_title, '') || ' ' || 
        COALESCE(bs.current_company, '')
      ) as exact_keyword_matches,
      -- 计算新的动态Alpha
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
      -- 计算原始组合分数 (新权重)
      (er.alpha_weight * er.similarity_score + (1.0 - er.alpha_weight) * er.fts_score) as raw_score,
      -- 大幅提升关键词匹配奖励
      CASE 
        WHEN er.exact_keyword_matches > 0 
        THEN (er.alpha_weight * er.similarity_score + (1.0 - er.alpha_weight) * er.fts_score) * 
             (1.0 + (er.exact_keyword_matches * 0.25)) -- 从5%提升到25%
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

-- 添加注释
COMMENT ON FUNCTION search_candidates_enhanced IS '
最终召回率优化版本
- 大幅降低向量权重 (35%向量 + 65%FTS)
- 超宽松的搜索条件确保最大召回
- 增强关键词匹配奖励 (25%)
- 目标: 95%+ 召回率
';

-- 验证优化
SELECT '最终召回率优化完成' as status; 