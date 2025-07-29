-- 智能地理位置匹配修复脚本
-- 创建日期: 2025-01-27
-- 功能: 添加智能地理位置匹配，支持层级地理关系（如中国包含杭州、北京等）

-- ===== 第一步：删除现有函数避免冲突 =====

-- 删除现有的search_candidates_enhanced函数（可能有多个版本）
DROP FUNCTION IF EXISTS search_candidates_enhanced(TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS search_candidates_enhanced_v2(TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT);

-- 删除现有的search_jobs_enhanced函数
DROP FUNCTION IF EXISTS search_jobs_enhanced(TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT);

-- 删除可能存在的smart_location_match函数
DROP FUNCTION IF EXISTS smart_location_match(TEXT, TEXT);

-- ===== 第二步：创建智能地理位置匹配函数 =====

CREATE OR REPLACE FUNCTION smart_location_match(
  candidate_location TEXT,
  filter_location TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  chinese_cities TEXT[] := ARRAY[
    '北京', '上海', '天津', '重庆', '广州', '深圳', '杭州', '南京', '苏州', '武汉',
    '成都', '西安', '济南', '青岛', '大连', '沈阳', '长春', '哈尔滨', '石家庄', '太原',
    '呼和浩特', '兰州', '西宁', '银川', '乌鲁木齐', '拉萨', '昆明', '贵阳', '南宁', '海口',
    '三亚', '福州', '厦门', '南昌', '长沙', '郑州', '合肥', '无锡', '常州', '徐州',
    '温州', '宁波', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水',
    '东莞', '中山', '珠海', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州',
    '汕尾', '河源', '阳江', '清远', '韶关', '潮州', '揭阳', '云浮'
  ];
  
  chinese_provinces TEXT[] := ARRAY[
    '广东', '江苏', '山东', '浙江', '河南', '四川', '湖北', '湖南', '河北', '福建',
    '安徽', '陕西', '辽宁', '江西', '山西', '黑龙江', '吉林', '云南', '贵州', '新疆',
    '甘肃', '内蒙古', '青海', '广西', '宁夏', '海南', '西藏'
  ];
  
  -- 主要国家和地区
  countries TEXT[] := ARRAY[
    '中国', '美国', '英国', '德国', '法国', '日本', '韩国', '新加坡', '澳大利亚', '加拿大'
  ];
BEGIN
  -- 如果没有筛选条件，返回true
  IF filter_location IS NULL OR filter_location = '' THEN
    RETURN TRUE;
  END IF;
  
  -- 如果没有候选人位置信息，返回false
  IF candidate_location IS NULL OR candidate_location = '' THEN
    RETURN FALSE;
  END IF;
  
  -- 直接匹配（包含模糊匹配）
  IF candidate_location ILIKE '%' || filter_location || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- 层级匹配逻辑
  -- 如果筛选条件是"中国"，匹配所有中国城市和省份
  IF filter_location ILIKE '%中国%' THEN
    -- 检查是否包含中国的城市
    IF EXISTS (
      SELECT 1 FROM unnest(chinese_cities) AS city 
      WHERE candidate_location ILIKE '%' || city || '%'
    ) THEN
      RETURN TRUE;
    END IF;
    
    -- 检查是否包含中国的省份
    IF EXISTS (
      SELECT 1 FROM unnest(chinese_provinces) AS province 
      WHERE candidate_location ILIKE '%' || province || '%'
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- 反向匹配：如果候选人位置包含筛选词
  IF filter_location ILIKE '%' || candidate_location || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- 默认返回false
  RETURN FALSE;
END;
$$;

-- ===== 第三步：创建增强的候选人搜索函数 =====

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
  WITH 
  -- 1. 向量搜索结果（更宽松的阈值）
  vector_candidates AS (
    SELECT 
      r.*,
      (1.0 - (r.embedding <-> query_embedding::vector)) AS similarity_score,
      0.0 AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND smart_location_match(r.location, location_filter)
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND (1.0 - (r.embedding <-> query_embedding::vector)) >= similarity_threshold
    ORDER BY r.embedding <-> query_embedding::vector
    LIMIT match_count
  ),
  
  -- 2. FTS搜索结果
  fts_candidates AS (
    SELECT 
      r.*,
      0.0 AS similarity_score,
      ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32) AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND smart_location_match(r.location, location_filter)
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND r.fts_document @@ plainto_tsquery('chinese_zh', query_text)
    ORDER BY ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32) DESC
    LIMIT match_count
  ),
  
  -- 3. 合并结果
  combined_results AS (
    SELECT 
      id, name, email, phone, current_title, current_company, location,
      years_of_experience, expected_salary_min, expected_salary_max,
      skills, education, experience, certifications, languages, status,
      GREATEST(similarity_score, 0.0) AS similarity,
      GREATEST(fts_score, 0.0) AS fts_rank,
      0 AS exact_matches,
      0.7 AS dynamic_alpha,
      (0.7 * GREATEST(similarity_score, 0.0) + 0.3 * GREATEST(fts_score, 0.0)) AS raw_combined_score
    FROM (
      SELECT * FROM vector_candidates
      UNION ALL
      SELECT * FROM fts_candidates
    ) AS all_results
  ),
  
  -- 4. 去重并计算最终分数
  final_results AS (
    SELECT DISTINCT ON (id)
      *,
      raw_combined_score AS boosted_score,
      raw_combined_score AS final_score
    FROM combined_results
    ORDER BY id, raw_combined_score DESC
  )
  
  SELECT 
    fr.id, fr.name, fr.email, fr.phone, fr.current_title, fr.current_company, 
    fr.location, fr.years_of_experience, fr.expected_salary_min, fr.expected_salary_max,
    fr.skills, fr.education, fr.experience, fr.certifications, fr.languages, fr.status,
    fr.similarity, fr.fts_rank, fr.exact_matches, fr.dynamic_alpha,
    fr.raw_combined_score, fr.boosted_score, fr.final_score
  FROM final_results fr
  ORDER BY fr.final_score DESC
  LIMIT match_count;
END;
$$;

-- ===== 第四步：创建增强的职位搜索函数 =====

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
  id                   UUID,
  title                TEXT,
  company              TEXT,
  location             TEXT,
  employment_type      TEXT,
  salary_min           INTEGER,
  salary_max           INTEGER,
  currency             TEXT,
  description          TEXT,
  requirements         TEXT,
  benefits             TEXT,
  skills_required      TEXT[],
  experience_required  INTEGER,
  education_required   TEXT,
  industry             TEXT,
  department           TEXT,
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
  WITH enhanced_results AS (
    SELECT 
      j.id, j.title, j.company, j.location, j.employment_type,
      j.salary_min, j.salary_max, j.currency, j.description, j.requirements, j.benefits,
      j.skills_required, j.experience_required, j.education_required, j.industry, j.department, j.status,
      
      (1 - (j.embedding <=> query_embedding::vector))::REAL AS similarity_score,
      ts_rank(j.fts_document, plainto_tsquery('chinese_zh', query_text))::REAL AS fts_score,
      0 AS exact_keyword_matches
      
    FROM jobs j
    WHERE 
      j.status = status_filter
      AND smart_location_match(j.location, location_filter)
      AND (experience_min IS NULL OR j.experience_required >= experience_min)
      AND (experience_max IS NULL OR j.experience_required <= experience_max)
      AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
      AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
      AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
      AND ((1 - (j.embedding <=> query_embedding::vector)) >= similarity_threshold
           OR j.fts_document @@ plainto_tsquery('chinese_zh', query_text))
  ),
  
  final_results AS (
    SELECT 
      *,
      0.7 AS dynamic_alpha_weight,
      (0.7 * similarity_score + 0.3 * fts_score) AS raw_combined,
      (0.7 * similarity_score + 0.3 * fts_score) AS boosted_combined
    FROM enhanced_results
  )
  
  SELECT 
    f.id, f.title, f.company, f.location, f.employment_type,
    f.salary_min, f.salary_max, f.currency, f.description, f.requirements, f.benefits,
    f.skills_required, f.experience_required, f.education_required, f.industry, f.department, f.status,
    f.similarity_score, f.fts_score, f.exact_keyword_matches, f.dynamic_alpha_weight,
    f.raw_combined, f.boosted_combined, f.boosted_combined
  FROM final_results f
  ORDER BY f.boosted_combined DESC
  LIMIT match_count;
END;
$$;

-- ===== 第五步：创建测试函数 =====

COMMENT ON FUNCTION smart_location_match IS '智能地理位置匹配函数 - 支持层级地理关系匹配';
COMMENT ON FUNCTION search_candidates_enhanced IS '增强候选人搜索函数 - 使用智能地理位置匹配';
COMMENT ON FUNCTION search_jobs_enhanced IS '增强职位搜索函数 - 使用智能地理位置匹配';

-- ===== 完成 =====
-- 执行完成后，可以运行以下测试：
-- SELECT smart_location_match('杭州', '中国'); -- 应该返回 true
-- SELECT smart_location_match('北京', '中国'); -- 应该返回 true  
-- SELECT smart_location_match('纽约', '中国'); -- 应该返回 false 