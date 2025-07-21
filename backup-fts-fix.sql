-- 备用FTS修复方案
-- 如果中文分词有问题，使用更简单但可靠的方法

-- 1. 使用simple配置重新生成FTS文档
UPDATE resumes 
SET fts_document = to_tsvector('simple',
  coalesce(name, '') || ' ' ||
  coalesce(current_title, '') || ' ' ||
  coalesce(current_company, '') || ' ' ||
  coalesce(location, '') || ' ' ||
  array_to_string(coalesce(skills, ARRAY[]::text[]), ' ')
)
WHERE id IS NOT NULL;

-- 2. 测试simple配置的效果
SELECT 
  name,
  current_company,
  fts_document,
  ts_rank(fts_document, plainto_tsquery('simple', '小米')) as simple_rank,
  fts_document @@ plainto_tsquery('simple', '小米') as simple_matches
FROM resumes 
WHERE name = '贝文瑾';

-- 3. 如果还是不行，创建自定义的文本匹配函数
CREATE OR REPLACE FUNCTION calculate_text_similarity(
  candidate_text TEXT,
  query_text TEXT
) RETURNS FLOAT AS $$
BEGIN
  -- 简单的文本相似度计算
  IF candidate_text ILIKE '%' || query_text || '%' THEN
    RETURN 1.0;
  ELSIF candidate_text ILIKE '%' || split_part(query_text, ' ', 1) || '%' THEN
    RETURN 0.5;
  ELSE
    RETURN 0.0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. 测试自定义函数
SELECT 
  name,
  current_company,
  calculate_text_similarity(
    name || ' ' || current_company || ' ' || current_title,
    '小米'
  ) as custom_similarity
FROM resumes 
WHERE name = '贝文瑾'; 