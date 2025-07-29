-- 修复函数名冲突问题
-- Migration: Fix Function Name Conflict
-- Created: 2025-01-27
-- 修复: 删除所有同名函数，重新创建唯一版本

-- 1. 删除所有可能存在的同名函数
DROP FUNCTION IF EXISTS count_exact_keyword_matches(TEXT, TEXT);
DROP FUNCTION IF EXISTS count_exact_keyword_matches(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS calculate_dynamic_alpha(TEXT, REAL, REAL, INTEGER);
DROP FUNCTION IF EXISTS calculate_dynamic_alpha(TEXT, REAL, REAL);

-- 2. 重新创建精确关键词匹配统计函数
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

-- 3. 重新创建动态Alpha计算函数
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
  -- 输入验证
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN base_alpha;
  END IF;
  
  -- 计算查询特征
  query_length := length(trim(query_text));
  word_count := array_length(string_to_array(trim(query_text), ' '), 1);
  has_special_chars := query_text ~ '[+#@.-]';
  
  -- 动态调整规则
  
  -- 规则1: 短查询 (1-2个词) - 更依赖FTS
  IF word_count <= 2 THEN
    alpha_adjustment := alpha_adjustment - 0.15;
  END IF;
  
  -- 规则2: 长查询 (5+个词) - 更依赖向量语义
  IF word_count >= 5 THEN
    alpha_adjustment := alpha_adjustment + 0.10;
  END IF;
  
  -- 规则3: 技术术语 (包含特殊字符) - 更依赖FTS精确匹配
  IF has_special_chars THEN
    alpha_adjustment := alpha_adjustment - 0.10;
  END IF;
  
  -- 规则4: 精确关键词匹配多 - 提升FTS权重
  IF exact_keyword_matches >= 2 THEN
    alpha_adjustment := alpha_adjustment - 0.05;
  END IF;
  
  -- 规则5: 向量分数很高 - 信任向量结果
  IF similarity_score > 0.7 THEN
    alpha_adjustment := alpha_adjustment + 0.05;
  END IF;
  
  -- 规则6: FTS分数很高 - 信任FTS结果
  IF fts_score > 0.5 THEN
    alpha_adjustment := alpha_adjustment - 0.05;
  END IF;
  
  -- 计算最终Alpha值
  final_alpha := base_alpha + alpha_adjustment;
  
  -- 确保Alpha在合理范围内 [0.3, 0.8]
  final_alpha := GREATEST(0.3, LEAST(0.8, final_alpha));
  
  RETURN final_alpha;
END;
$$;

-- 4. 验证函数创建
SELECT 'count_exact_keyword_matches函数创建成功' as status;
SELECT 'calculate_dynamic_alpha函数创建成功' as status;

-- 5. 测试函数
SELECT count_exact_keyword_matches('前端开发', '前端工程师开发经验') as test_match_count;
SELECT calculate_dynamic_alpha('前端开发', 0.6, 0.3, 2) as test_alpha; 