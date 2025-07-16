-- 改进关键词提取功能
-- 让搜索能从"前端人选有哪几个"中提取"前端"等关键词

-- 1. 创建更智能的关键词提取函数
CREATE OR REPLACE FUNCTION extract_search_keywords(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_text TEXT;
  keywords TEXT := '';
  tech_terms TEXT[] := ARRAY[
    '前端', 'frontend', 'react', 'vue', 'angular',
    '后端', 'backend', 'golang', 'java', 'python', 'node',
    '全栈', 'fullstack', 'full-stack',
    '产品', 'product', '经理', 'manager',
    '数据', 'data', '分析', 'analyst',
    '人工智能', 'ai', '机器学习', 'ml',
    '算法', 'algorithm',
    '研发', '开发', 'developer', 'engineer',
    '高级', 'senior', '初级', 'junior',
    'typescript', 'javascript', 'mysql', 'redis',
    'next.js', 'express', 'spring'
  ];
  term TEXT;
BEGIN
  -- 清理输入文本
  cleaned_text := lower(trim(regexp_replace(input_text, '[^\w\s\u4e00-\u9fff.-]', ' ', 'g')));
  
  -- 提取技术相关关键词
  FOREACH term IN ARRAY tech_terms
  LOOP
    IF cleaned_text ILIKE '%' || term || '%' THEN
      IF keywords != '' THEN
        keywords := keywords || ' ';
      END IF;
      keywords := keywords || term;
    END IF;
  END LOOP;
  
  -- 如果没有找到技术关键词，返回清理后的原文本
  IF keywords = '' THEN
    RETURN cleaned_text;
  END IF;
  
  RETURN keywords;
END;
$$;

-- 2. 创建改进的双语查询构建器，支持关键词提取
CREATE OR REPLACE FUNCTION build_smart_bilingual_tsquery(input_text TEXT)
RETURNS TSQUERY
LANGUAGE plpgsql
AS $$
DECLARE
  extracted_keywords TEXT;
  normalized_text TEXT;
  terms TEXT[];
  term TEXT;
  result_query TEXT := '';
  mapped_term TEXT;
BEGIN
  -- 提取关键词
  extracted_keywords := extract_search_keywords(input_text);
  
  -- 标准化文本
  normalized_text := regexp_replace(trim(extracted_keywords), '\s+', ' ', 'g');
  
  -- 分割成词条
  terms := string_to_array(normalized_text, ' ');
  
  -- 为每个词条构建双语查询
  FOREACH term IN ARRAY terms
  LOOP
    IF trim(term) != '' THEN
      IF result_query != '' THEN
        result_query := result_query || ' & ';
      END IF;
      
      -- 开始构建该词条的查询
      result_query := result_query || '(';
      
      -- 1. 原词条的精确匹配和前缀匹配
      result_query := result_query || quote_literal(trim(term)) || ' | ' || quote_literal(trim(term)) || ':*';
      
      -- 2. 查找中文到英文的映射
      SELECT english_term INTO mapped_term 
      FROM bilingual_mapping 
      WHERE chinese_term = trim(term) 
      LIMIT 1;
      
      IF mapped_term IS NOT NULL THEN
        result_query := result_query || ' | ' || quote_literal(mapped_term) || ' | ' || quote_literal(mapped_term) || ':*';
      END IF;
      
      -- 3. 查找英文到中文的映射
      SELECT chinese_term INTO mapped_term 
      FROM bilingual_mapping 
      WHERE english_term = trim(term) 
      LIMIT 1;
      
      IF mapped_term IS NOT NULL THEN
        result_query := result_query || ' | ' || quote_literal(mapped_term) || ' | ' || quote_literal(mapped_term) || ':*';
      END IF;
      
      result_query := result_query || ')';
    END IF;
  END LOOP;
  
  -- 如果没有有效词条，返回默认查询
  IF result_query = '' THEN
    RETURN plainto_tsquery('chinese_zh', input_text);
  END IF;
  
  -- 尝试构建查询，如果失败则回退到 plainto_tsquery
  BEGIN
    RETURN to_tsquery('chinese_zh', result_query);
  EXCEPTION WHEN OTHERS THEN
    RETURN plainto_tsquery('chinese_zh', input_text);
  END;
END;
$$;

-- 3. 更新搜索函数使用新的智能查询构建器
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding TEXT,
  query_text TEXT, 
  similarity_threshold REAL DEFAULT 0.05,
  match_count INT DEFAULT 20,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id_param UUID DEFAULT NULL,
  fts_weight REAL DEFAULT 0.3,
  vector_weight REAL DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills TEXT[],
  education JSONB,
  experience JSONB,
  certifications JSONB,
  languages JSONB,
  status TEXT,
  similarity REAL,
  fts_rank REAL,
  combined_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 使用智能双语FTS查询构建器 (新功能!)
  query_tsquery := build_smart_bilingual_tsquery(query_text);
  
  RETURN QUERY
  SELECT 
    resumes.id,
    resumes.name,
    resumes.email,
    resumes.phone,
    resumes.current_title,
    resumes.current_company,
    resumes.location,
    resumes.years_of_experience,
    resumes.expected_salary_min,
    resumes.expected_salary_max,
    resumes.skills,
    resumes.education,
    resumes.experience,
    resumes.certifications,
    resumes.languages,
    resumes.status,
    (1 - (resumes.embedding <=> query_vec))::REAL AS similarity,
    ts_rank(resumes.fts_document, query_tsquery)::REAL AS fts_rank,
    ((1 - (resumes.embedding <=> query_vec)) * vector_weight +
      ts_rank(resumes.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM resumes
  WHERE 
    resumes.status = status_filter
    AND (location_filter IS NULL OR resumes.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR resumes.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR resumes.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR resumes.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR resumes.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR resumes.skills && skills_filter)
    -- 改进的匹配条件：支持多种搜索方式
    AND (
      -- 向量相似度匹配
      (1 - (resumes.embedding <=> query_vec)) >= similarity_threshold
      -- 智能双语全文搜索匹配
      OR resumes.fts_document @@ query_tsquery
      -- 标题模糊匹配（处理分词问题）
      OR resumes.current_title ILIKE '%' || query_text || '%'
      -- 姓名模糊匹配
      OR resumes.name ILIKE '%' || query_text || '%'
      -- 公司名匹配
      OR resumes.current_company ILIKE '%' || query_text || '%'
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 4. 测试新的关键词提取功能
SELECT 
  '前端人选有哪几个？' as original_query,
  extract_search_keywords('前端人选有哪几个？') as extracted_keywords,
  build_smart_bilingual_tsquery('前端人选有哪几个？') as smart_query,
  '期望提取出"前端"关键词' as expectation; 