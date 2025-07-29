-- 简化版召回率优化
-- Migration: Simple Recall Fix for Enhanced Search
-- Created: 2025-01-27

-- 1. 创建同义词扩展函数
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
  
  RETURN expanded_query;
END;
$$;

-- 智能地理位置匹配函数
-- 支持层级地理关系匹配，例如：中国包含杭州、北京、上海等
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
  
  -- 如果筛选条件是省份，匹配该省份的主要城市
  -- 这里可以添加更详细的省份-城市映射逻辑
  
  -- 反向匹配：如果候选人位置包含筛选词
  IF filter_location ILIKE '%' || candidate_location || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- 默认返回false
  RETURN FALSE;
END;
$$;

-- 2. 更新原有的增强搜索函数 - 降低阈值并增加搜索范围
CREATE OR REPLACE FUNCTION search_candidates_enhanced(
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
BEGIN
  -- 扩展查询同义词
  expanded_query := expand_query_synonyms(query_text);
  
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
  
  -- 2. FTS搜索结果（包含原始查询和扩展查询）
  fts_candidates AS (
    SELECT 
      r.*,
      0.0 AS similarity_score,
      GREATEST(
        ts_rank_cd(r.fts_document, plainto_tsquery('chinese_zh', query_text), 32),
        ts_rank_cd(r.fts_document, to_tsquery('chinese_zh', 
          regexp_replace(expanded_query, '\s+', '|', 'g')
        ), 32)
      ) AS fts_score
    FROM resumes r
    WHERE r.status = status_filter
      AND smart_location_match(r.location, location_filter)
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
  
  -- 7. 关键词提升
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

-- 3. 添加注释
COMMENT ON FUNCTION search_candidates_enhanced IS '优化版增强搜索 - 默认阈值-1.0，返回20个结果，支持同义词扩展';
COMMENT ON FUNCTION expand_query_synonyms IS '查询同义词扩展函数 - 解决AI、技术栈等关键词不匹配问题'; 