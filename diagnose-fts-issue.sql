-- 诊断FTS搜索问题
-- 在Supabase SQL Editor中执行

-- 1. 检查贝文瑾的FTS文档内容
SELECT 
  name,
  current_company,
  current_title,
  fts_document,
  length(fts_document::text) as fts_doc_length
FROM resumes 
WHERE name = '贝文瑾';

-- 2. 测试FTS查询是否工作
SELECT 
  name,
  current_company,
  fts_document,
  to_tsquery('chinese_zh', '小米') as query_result,
  fts_document @@ to_tsquery('chinese_zh', '小米') as matches_xiaomi,
  ts_rank(fts_document, to_tsquery('chinese_zh', '小米')) as rank_xiaomi
FROM resumes 
WHERE name = '贝文瑾';

-- 3. 检查中文分词配置
SELECT 
  cfgname as config_name,
  cfgparser as parser_oid,
  (SELECT prsname FROM pg_ts_parser WHERE oid = cfgparser) as parser_name
FROM pg_ts_config 
WHERE cfgname = 'chinese_zh';

-- 4. 测试不同的查询方式
SELECT 
  name,
  current_company,
  -- 尝试不同的查询方法
  ts_rank(fts_document, plainto_tsquery('chinese_zh', '小米')) as rank_plainto,
  ts_rank(fts_document, websearch_to_tsquery('chinese_zh', '小米')) as rank_websearch,
  ts_rank(fts_document, to_tsquery('simple', '小米')) as rank_simple,
  fts_document @@ plainto_tsquery('chinese_zh', '小米') as matches_plainto
FROM resumes 
WHERE name = '贝文瑾';

-- 5. 检查FTS文档是否为空
SELECT 
  status,
  COUNT(*) as total_count,
  COUNT(fts_document) as has_fts_doc,
  COUNT(CASE WHEN fts_document IS NOT NULL AND fts_document != '' THEN 1 END) as non_empty_fts,
  AVG(length(fts_document::text)) as avg_fts_length
FROM resumes 
GROUP BY status;

-- 6. 重新生成FTS文档（修复方案）
-- 如果FTS文档为空或有问题，执行以下更新：

UPDATE resumes 
SET fts_document = to_tsvector('chinese_zh',
  coalesce(name, '') || ' ' ||
  coalesce(current_title, '') || ' ' ||
  coalesce(current_company, '') || ' ' ||
  coalesce(location, '') || ' ' ||
  array_to_string(coalesce(skills, ARRAY[]::text[]), ' ')
)
WHERE fts_document IS NULL 
   OR fts_document = '' 
   OR length(fts_document::text) < 10;

-- 7. 验证修复结果
SELECT 
  name,
  current_company,
  length(fts_document::text) as fts_doc_length,
  ts_rank(fts_document, plainto_tsquery('chinese_zh', '小米')) as rank_after_fix,
  fts_document @@ plainto_tsquery('chinese_zh', '小米') as matches_after_fix
FROM resumes 
WHERE name = '贝文瑾';

-- 8. 如果中文分词仍有问题，尝试使用simple配置
-- 这是一个备用方案，可以保证基本的FTS功能
SELECT 
  name,
  current_company,
  ts_rank(
    to_tsvector('simple', name || ' ' || current_company || ' ' || current_title),
    plainto_tsquery('simple', '小米')
  ) as simple_rank
FROM resumes 
WHERE name = '贝文瑾'; 