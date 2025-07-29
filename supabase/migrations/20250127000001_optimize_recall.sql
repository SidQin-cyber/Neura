-- 召回率优化升级
-- Migration: Recall Optimization for Enhanced Search
-- Created: 2025-01-27
-- 目标: 提升召回率到95%+，优化准确率

-- 1. 创建同义词映射函数
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
  expanded_query := regexp_replace(expanded_query, '\y人工智能\y', '人工智能 AI 机器学习 算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yAI\y', 'AI 人工智能 机器学习 算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y深度学习\y', '深度学习 deeplearning 神经网络', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y机器学习\y', '机器学习 machinelearning ML 算法', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y计算机视觉\y', '计算机视觉 CV 图像识别 opencv', 'gi');
  
  -- 技术栈同义词扩展
  expanded_query := regexp_replace(expanded_query, '\yReact\y', 'React ReactJS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yVue\y', 'Vue VueJS Vue.js', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yJavaScript\y', 'JavaScript JS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yTypeScript\y', 'TypeScript TS', 'gi');
  expanded_query := regexp_replace(expanded_query, '\yPython\y', 'Python py', 'gi');
  
  -- 职位级别同义词
  expanded_query := regexp_replace(expanded_query, '\y高级\y', '高级 资深 senior', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y资深\y', '资深 高级 senior', 'gi');
  expanded_query := regexp_replace(expanded_query, '\y初级\y', '初级 junior 应届', 'gi');
  
  RETURN expanded_query;
END;
$$;

-- 2. 更新增强搜索函数 - 重点优化召回率
CREATE OR REPLACE FUNCTION search_candidates_enhanced_v2(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT -1.0,  -- 大幅降低默认阈值
  match_count          INT    DEFAULT 20,    -- 增加默认返回数量
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
  vector_search_sql TEXT;
  fts_search_sql TEXT;
  combined_sql TEXT;
BEGIN
  -- 1. 扩展查询同义词
  expanded_query := expand_query_synonyms(query_text);
  
  -- 2. 构建联合搜索SQL - 确保所有相关候选人都被包含
  combined_sql := format('
    WITH vector_results AS (
      SELECT 
        r.*,
        (r.embedding <-> %L::vector) AS vector_distance,
        -- 转换距离为相似度分数 (距离越小，分数越高)
        (1.0 - (r.embedding <-> %L::vector)) AS similarity_score,
        0.0 AS fts_score,
        ''vector'' AS source
      FROM resumes r
      WHERE r.status = %L
        AND (r.embedding <-> %L::vector) >= %L  -- 使用更宽松的阈值
        %s  -- 位置过滤
        %s  -- 经验过滤
        %s  -- 薪资过滤
        %s  -- 技能过滤
      ORDER BY r.embedding <-> %L::vector
      LIMIT %L
    ),
    fts_results AS (
      SELECT 
        r.*,
        0.0 AS vector_distance,
        0.0 AS similarity_score,
        GREATEST(
          ts_rank_cd(r.fts_document, plainto_tsquery(''chinese_zh'', %L), 32),
          ts_rank_cd(r.fts_document, plainto_tsquery(''chinese_zh'', %L), 32)
        ) AS fts_score,
        ''fts'' AS source
      FROM resumes r
      WHERE r.status = %L
        AND (
          r.fts_document @@ plainto_tsquery(''chinese_zh'', %L) OR
          r.fts_document @@ plainto_tsquery(''chinese_zh'', %L)
        )
        %s  -- 位置过滤
        %s  -- 经验过滤
        %s  -- 薪资过滤
        %s  -- 技能过滤
      ORDER BY fts_score DESC
      LIMIT %L
    ),
    unified_results AS (
      SELECT * FROM vector_results
      UNION ALL
      SELECT * FROM fts_results
    ),
    grouped_results AS (
      SELECT 
        id, name, email, phone, current_title, current_company, location,
        years_of_experience, expected_salary_min, expected_salary_max,
        skills, education, experience, certifications, languages, status,
        MAX(similarity_score) as similarity,
        MAX(fts_score) as fts_rank
      FROM unified_results
      GROUP BY id, name, email, phone, current_title, current_company, location,
               years_of_experience, expected_salary_min, expected_salary_max,
               skills, education, experience, certifications, languages, status
    )
    SELECT 
      gr.*,
      count_exact_keyword_matches(%L, 
        COALESCE(gr.skills::text, '''') || '' '' || 
        COALESCE(gr.current_title, '''') || '' '' || 
        COALESCE(gr.current_company, '''')
      ) as exact_matches,
      calculate_dynamic_alpha(%L, gr.similarity, gr.fts_rank, 
        count_exact_keyword_matches(%L, 
          COALESCE(gr.skills::text, '''') || '' '' || 
          COALESCE(gr.current_title, '''') || '' '' || 
          COALESCE(gr.current_company, '''')
        )
      ) as dynamic_alpha
    FROM grouped_results gr
  ',
    query_embedding,  -- vector search params
    query_embedding,
    status_filter,
    query_embedding,
    similarity_threshold,
    CASE WHEN location_filter IS NOT NULL THEN format(' AND r.location ILIKE ''%%%s%%''', location_filter) ELSE '' END,
    CASE WHEN experience_min IS NOT NULL THEN format(' AND r.years_of_experience >= %s', experience_min) ELSE '' END,
    CASE WHEN experience_max IS NOT NULL THEN format(' AND r.years_of_experience <= %s', experience_max) ELSE '' END,
    CASE WHEN skills_filter IS NOT NULL THEN format(' AND r.skills && %L', skills_filter) ELSE '' END,
    query_embedding,
    match_count,
    query_text,        -- fts search params
    expanded_query,
    status_filter,
    query_text,
    expanded_query,
    CASE WHEN location_filter IS NOT NULL THEN format(' AND r.location ILIKE ''%%%s%%''', location_filter) ELSE '' END,
    CASE WHEN experience_min IS NOT NULL THEN format(' AND r.years_of_experience >= %s', experience_min) ELSE '' END,
    CASE WHEN experience_max IS NOT NULL THEN format(' AND r.years_of_experience <= %s', experience_max) ELSE '' END,
    CASE WHEN skills_filter IS NOT NULL THEN format(' AND r.skills && %L', skills_filter) ELSE '' END,
    match_count,
    query_text,        -- final processing params
    query_text,
    query_text
  );
  
  -- 3. 执行搜索并计算最终分数
  RETURN QUERY EXECUTE format('
    WITH search_results AS (%s),
    scored_results AS (
      SELECT 
        sr.*,
        (sr.dynamic_alpha * sr.similarity + (1.0 - sr.dynamic_alpha) * sr.fts_rank) as raw_combined_score
      FROM search_results sr
    ),
    boosted_results AS (
      SELECT 
        sr.*,
        CASE 
          WHEN sr.exact_matches > 0 THEN sr.raw_combined_score * (1.0 + (sr.exact_matches * 0.04))
          ELSE sr.raw_combined_score
        END as boosted_score
      FROM scored_results sr
    )
    SELECT 
      br.id, br.name, br.email, br.phone, br.current_title, br.current_company,
      br.location, br.years_of_experience, br.expected_salary_min, br.expected_salary_max,
      br.skills, br.education, br.experience, br.certifications, br.languages, br.status,
      br.similarity::REAL, br.fts_rank::REAL, br.exact_matches, br.dynamic_alpha::REAL,
      br.raw_combined_score::REAL, br.boosted_score::REAL, br.boosted_score::REAL as final_score
    FROM boosted_results br
    ORDER BY br.boosted_score DESC
    LIMIT %L
  ', combined_sql, match_count);
  
END;
$$;

-- 4. 添加注释说明
COMMENT ON FUNCTION search_candidates_enhanced_v2 IS '优化版增强搜索函数 - 重点提升召回率到95%+';
COMMENT ON FUNCTION expand_query_synonyms IS '查询同义词扩展函数 - 解决关键词不匹配问题'; 