-- 最终的中文FTS修复方案
-- 解决中文分词和匹配问题

-- Step 1: 诊断当前FTS配置
SELECT 
  cfgname,
  (SELECT prsname FROM pg_ts_parser WHERE oid = cfgparser) as parser_name,
  cfgparser
FROM pg_ts_config 
WHERE cfgname IN ('chinese_zh', 'simple', 'english');

-- Step 2: 测试不同分词器对"小米"的处理
SELECT 
  'chinese_zh' as config,
  to_tsvector('chinese_zh', '小米通讯技术有限公司') as tokens,
  plainto_tsquery('chinese_zh', '小米') as query;

SELECT 
  'simple' as config,
  to_tsvector('simple', '小米通讯技术有限公司') as tokens,
  plainto_tsquery('simple', '小米') as query;

-- Step 3: 查看贝文瑾的当前FTS文档内容
SELECT 
  name,
  current_company,
  fts_document,
  to_tsvector('simple', current_company) as simple_company_tokens,
  current_company ILIKE '%小米%' as contains_xiaomi
FROM resumes 
WHERE name = '贝文瑾';

-- Step 4: 创建增强的FTS文档生成函数
CREATE OR REPLACE FUNCTION generate_enhanced_fts_document(
  p_name TEXT,
  p_title TEXT,
  p_company TEXT,
  p_location TEXT,
  p_skills TEXT[]
) RETURNS tsvector AS $$
DECLARE
  content TEXT;
  simple_doc tsvector;
  chinese_doc tsvector;
BEGIN
  -- 构建完整文本内容
  content := coalesce(p_name, '') || ' ' ||
             coalesce(p_title, '') || ' ' ||
             coalesce(p_company, '') || ' ' ||
             coalesce(p_location, '') || ' ' ||
             array_to_string(coalesce(p_skills, ARRAY[]::text[]), ' ');
  
  -- 使用multiple配置生成FTS文档
  -- 1. Simple分词器 - 保证基本匹配
  simple_doc := to_tsvector('simple', content);
  
  -- 2. 中文分词器 - 语义匹配
  BEGIN
    chinese_doc := to_tsvector('chinese_zh', content);
  EXCEPTION WHEN OTHERS THEN
    chinese_doc := to_tsvector('simple', content);
  END;
  
  -- 3. 合并两种分词结果
  RETURN simple_doc || chinese_doc;
END;
$$ LANGUAGE plpgsql;

-- Step 5: 使用增强函数重新生成所有FTS文档
UPDATE resumes 
SET fts_document = generate_enhanced_fts_document(
  name,
  current_title,
  current_company,
  location,
  skills
)
WHERE id IS NOT NULL;

-- Step 6: 验证修复效果
SELECT 
  name,
  current_company,
  current_title,
  -- 测试不同查询方式
  fts_document @@ plainto_tsquery('simple', '小米') as matches_simple,
  fts_document @@ plainto_tsquery('chinese_zh', '小米') as matches_chinese,
  ts_rank(fts_document, plainto_tsquery('simple', '小米')) as rank_simple,
  ts_rank(fts_document, plainto_tsquery('chinese_zh', '小米')) as rank_chinese,
  -- 计算最高分数
  GREATEST(
    ts_rank(fts_document, plainto_tsquery('simple', '小米')),
    ts_rank(fts_document, plainto_tsquery('chinese_zh', '小米'))
  ) as best_rank
FROM resumes 
WHERE name = '贝文瑾';

-- Step 7: 创建智能FTS查询函数
CREATE OR REPLACE FUNCTION smart_fts_rank(
  doc tsvector,
  query_text TEXT
) RETURNS FLOAT AS $$
DECLARE
  simple_rank FLOAT;
  chinese_rank FLOAT;
  ilike_bonus FLOAT := 0;
BEGIN
  -- 计算simple分词器分数
  simple_rank := ts_rank(doc, plainto_tsquery('simple', query_text));
  
  -- 计算中文分词器分数
  BEGIN
    chinese_rank := ts_rank(doc, plainto_tsquery('chinese_zh', query_text));
  EXCEPTION WHEN OTHERS THEN
    chinese_rank := 0;
  END;
  
  -- 返回最高分数
  RETURN GREATEST(simple_rank, chinese_rank);
END;
$$ LANGUAGE plpgsql;

-- Step 8: 测试智能FTS查询函数
SELECT 
  name,
  current_company,
  smart_fts_rank(fts_document, '小米') as smart_xiaomi_rank,
  smart_fts_rank(fts_document, '机器人') as smart_robot_rank,
  smart_fts_rank(fts_document, '贝文瑾') as smart_name_rank
FROM resumes 
WHERE name IN ('贝文瑾', '鲍云清')
ORDER BY smart_fts_rank(fts_document, '小米') DESC;

-- Step 9: 如果上述方法仍有问题，使用最简单的fallback
-- 创建基于ILIKE的文本匹配函数
CREATE OR REPLACE FUNCTION fallback_text_match(
  candidate_name TEXT,
  candidate_company TEXT,
  candidate_title TEXT,
  query_text TEXT
) RETURNS FLOAT AS $$
DECLARE
  full_text TEXT;
  match_score FLOAT := 0;
BEGIN
  full_text := LOWER(coalesce(candidate_name, '') || ' ' || 
                     coalesce(candidate_company, '') || ' ' || 
                     coalesce(candidate_title, ''));
  query_text := LOWER(query_text);
  
  -- 完全匹配
  IF full_text ILIKE '%' || query_text || '%' THEN
    match_score := 1.0;
  -- 拆分查询词匹配
  ELSIF full_text ILIKE '%' || split_part(query_text, ' ', 1) || '%' THEN
    match_score := 0.8;
  ELSIF full_text ILIKE '%' || split_part(query_text, ' ', 2) || '%' THEN
    match_score := 0.6;
  END IF;
  
  RETURN match_score;
END;
$$ LANGUAGE plpgsql;

-- Step 10: 测试fallback函数
SELECT 
  name,
  current_company,
  fallback_text_match(name, current_company, current_title, '小米') as fallback_xiaomi,
  fallback_text_match(name, current_company, current_title, '机器人') as fallback_robot,
  fallback_text_match(name, current_company, current_title, '贝文瑾') as fallback_name
FROM resumes 
WHERE name IN ('贝文瑾', '鲍云清')
ORDER BY fallback_text_match(name, current_company, current_title, '小米') DESC; 