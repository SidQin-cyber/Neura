-- 修复数据类型匹配问题
-- Migration: Fix Type Matching Issues
-- Created: 2025-01-27
-- 修复: 创建多个函数重载版本处理不同数据类型

-- 1. 删除所有现有函数
DROP FUNCTION IF EXISTS count_exact_keyword_matches(TEXT, TEXT);
DROP FUNCTION IF EXISTS calculate_dynamic_alpha(TEXT, REAL, REAL, INTEGER);
DROP FUNCTION IF EXISTS calculate_dynamic_alpha(TEXT, DOUBLE PRECISION, REAL, INTEGER);

-- 2. 创建关键词匹配函数
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
BEGIN
  -- 输入验证
  IF query_text IS NULL OR target_text IS NULL OR 
     trim(query_text) = '' OR trim(target_text) = '' THEN
    RETURN 0;
  END IF;
  
  -- 标准化目标文本（转小写）
  normalized_target := lower(target_text);
  
  -- 分割查询词汇
  query_words := string_to_array(lower(trim(query_text)), ' ');
  
  -- 统计精确匹配
  FOREACH word IN ARRAY query_words
  LOOP
    IF word IS NOT NULL AND trim(word) != '' AND 
       position(trim(word) IN normalized_target) > 0 THEN
      match_count := match_count + 1;
    END IF;
  END LOOP;
  
  RETURN match_count;
END;
$$;

-- 3. 创建动态Alpha函数 - REAL版本
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
  base_alpha REAL := 0.65;
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
  
  -- 简化的动态调整规则
  IF word_count <= 2 THEN
    alpha_adjustment := -0.15;
  ELSIF word_count >= 5 THEN
    alpha_adjustment := 0.10;
  END IF;
  
  IF exact_keyword_matches >= 2 THEN
    alpha_adjustment := alpha_adjustment - 0.05;
  END IF;
  
  IF similarity_score > 0.7 THEN
    alpha_adjustment := alpha_adjustment + 0.05;
  END IF;
  
  IF fts_score > 0.5 THEN
    alpha_adjustment := alpha_adjustment - 0.05;
  END IF;
  
  final_alpha := base_alpha + alpha_adjustment;
  final_alpha := GREATEST(0.3, LEAST(0.8, final_alpha));
  
  RETURN final_alpha;
END;
$$;

-- 4. 创建动态Alpha函数 - DOUBLE PRECISION版本
CREATE OR REPLACE FUNCTION calculate_dynamic_alpha(
  query_text TEXT,
  similarity_score DOUBLE PRECISION,
  fts_score REAL,
  exact_keyword_matches INTEGER DEFAULT 0
)
RETURNS REAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 转换为REAL类型并调用主函数
  RETURN calculate_dynamic_alpha(
    query_text, 
    similarity_score::REAL, 
    fts_score, 
    exact_keyword_matches
  );
END;
$$;

-- 5. 创建动态Alpha函数 - 所有DOUBLE PRECISION版本
CREATE OR REPLACE FUNCTION calculate_dynamic_alpha(
  query_text TEXT,
  similarity_score DOUBLE PRECISION,
  fts_score DOUBLE PRECISION,
  exact_keyword_matches INTEGER DEFAULT 0
)
RETURNS REAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 转换为REAL类型并调用主函数
  RETURN calculate_dynamic_alpha(
    query_text, 
    similarity_score::REAL, 
    fts_score::REAL, 
    exact_keyword_matches
  );
END;
$$;

-- 6. 验证所有函数
SELECT 'count_exact_keyword_matches函数创建成功' as status;
SELECT 'calculate_dynamic_alpha (REAL)函数创建成功' as status;
SELECT 'calculate_dynamic_alpha (DOUBLE PRECISION)函数创建成功' as status;

-- 7. 测试所有版本
SELECT count_exact_keyword_matches('前端开发', '前端工程师开发经验') as test_match_count;
SELECT calculate_dynamic_alpha('前端开发', 0.6::REAL, 0.3::REAL, 2) as test_alpha_real;
SELECT calculate_dynamic_alpha('前端开发', 0.6::DOUBLE PRECISION, 0.3::REAL, 2) as test_alpha_double; 