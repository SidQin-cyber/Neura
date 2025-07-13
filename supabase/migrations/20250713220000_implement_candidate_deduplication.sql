-- ============================================================
-- Neura AI招聘平台 - 候选人去重逻辑实现
-- 实施方案：录入时去重，基于 owner_id + name + email + phone
-- 创建时间：2025-07-13 22:00:00
-- ============================================================

-- 1. 修改候选人插入函数，实现去重逻辑
CREATE OR REPLACE FUNCTION insert_candidate_with_embedding(
  p_owner_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_current_title TEXT,
  p_current_company TEXT,
  p_location TEXT,
  p_years_of_experience INT,
  p_expected_salary_min INT,
  p_expected_salary_max INT,
  p_skills TEXT[],
  p_education JSONB,
  p_experience JSONB,
  p_certifications JSONB,
  p_languages JSONB,
  p_raw_data JSONB,
  p_status TEXT,
  p_embedding TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id UUID;
  existing_id UUID;
  embedding_vector VECTOR(1536);
  search_text TEXT;
BEGIN
  -- 将字符串转换为VECTOR类型
  BEGIN
    embedding_vector := p_embedding::VECTOR(1536);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid embedding format: %', SQLERRM;
  END;
  
  -- 创建搜索文本（简单字符串拼接）
  search_text := COALESCE(p_name, '') || ' ' || 
                 COALESCE(p_current_title, '') || ' ' || 
                 COALESCE(p_current_company, '') || ' ' || 
                 COALESCE(p_location, '') || ' ' || 
                 COALESCE(array_to_string(p_skills, ' '), '');
  
  -- 🔍 检查是否存在重复记录（基于 owner_id + name + email + phone）
  -- 处理NULL值：使用IS NOT DISTINCT FROM来正确比较NULL值
  SELECT id INTO existing_id 
  FROM public.resumes 
  WHERE owner_id = p_owner_id 
    AND name = p_name 
    AND email IS NOT DISTINCT FROM p_email 
    AND phone IS NOT DISTINCT FROM p_phone
  LIMIT 1;
  
  -- 如果找到重复记录，更新现有记录
  IF existing_id IS NOT NULL THEN
    UPDATE public.resumes 
    SET 
      current_title = p_current_title,
      current_company = p_current_company,
      location = p_location,
      years_of_experience = p_years_of_experience,
      expected_salary_min = p_expected_salary_min,
      expected_salary_max = p_expected_salary_max,
      skills = p_skills,
      education = p_education,
      experience = p_experience,
      certifications = p_certifications,
      languages = p_languages,
      raw_data = p_raw_data,
      status = p_status,
      embedding = embedding_vector,
      fts_document = to_tsvector('simple', search_text),
      updated_at = now()
    WHERE id = existing_id;
    
    -- 返回更新的记录ID
    RETURN existing_id;
  ELSE
    -- 如果没有重复记录，插入新记录
    INSERT INTO public.resumes (
      owner_id, 
      name, 
      email, 
      phone, 
      current_title, 
      current_company, 
      location, 
      years_of_experience, 
      expected_salary_min, 
      expected_salary_max, 
      skills, 
      education, 
      experience, 
      certifications, 
      languages, 
      raw_data, 
      status, 
      embedding,
      fts_document,
      created_at,
      updated_at
    ) VALUES (
      p_owner_id, 
      p_name, 
      p_email, 
      p_phone, 
      p_current_title, 
      p_current_company, 
      p_location, 
      p_years_of_experience, 
      p_expected_salary_min, 
      p_expected_salary_max, 
      p_skills, 
      p_education, 
      p_experience, 
      p_certifications, 
      p_languages, 
      p_raw_data, 
      p_status, 
      embedding_vector,
      to_tsvector('simple', search_text),
      now(),
      now()
    ) RETURNING id INTO new_id;
    
    -- 返回新插入的记录ID
    RETURN new_id;
  END IF;
END;
$$;

-- 2. 创建唯一索引来加速去重查询
-- 注意：我们不能创建UNIQUE约束，因为需要允许NULL值的组合
-- 但是可以创建部分索引来加速查询
CREATE INDEX IF NOT EXISTS idx_resumes_deduplication 
ON public.resumes (owner_id, name, email, phone)
WHERE status = 'active';

-- 3. 创建去重辅助函数，用于清理现有的重复数据
CREATE OR REPLACE FUNCTION cleanup_duplicate_candidates(
  target_owner_id UUID DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  candidate_name TEXT,
  duplicate_count INT,
  kept_id UUID,
  removed_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  duplicate_record RECORD;
  keep_record RECORD;
  remove_ids UUID[];
BEGIN
  -- 查找所有重复的候选人记录
  FOR duplicate_record IN
    SELECT 
      r.owner_id,
      r.name,
      r.email,
      r.phone,
      COUNT(*) as duplicate_count,
      array_agg(r.id ORDER BY r.created_at DESC) as all_ids
    FROM public.resumes r
    WHERE (target_owner_id IS NULL OR r.owner_id = target_owner_id)
      AND r.status = 'active'
    GROUP BY r.owner_id, r.name, r.email, r.phone
    HAVING COUNT(*) > 1
  LOOP
    -- 保留最新的记录（数组第一个元素）
    keep_record.id := duplicate_record.all_ids[1];
    remove_ids := duplicate_record.all_ids[2:];
    
    -- 删除重复的记录
    DELETE FROM public.resumes 
    WHERE id = ANY(remove_ids);
    
    -- 返回清理结果
    RETURN QUERY SELECT 
      'CLEANED'::TEXT as action,
      duplicate_record.name as candidate_name,
      duplicate_record.duplicate_count as duplicate_count,
      keep_record.id as kept_id,
      remove_ids as removed_ids;
  END LOOP;
  
  -- 如果没有找到重复记录，返回提示信息
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'NO_DUPLICATES'::TEXT as action,
      'N/A'::TEXT as candidate_name,
      0 as duplicate_count,
      NULL::UUID as kept_id,
      ARRAY[]::UUID[] as removed_ids;
  END IF;
END;
$$;

-- 4. 验证去重逻辑
DO $$
BEGIN
  -- 检查函数是否创建成功
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_candidate_with_embedding') THEN
    RAISE NOTICE '✅ insert_candidate_with_embedding 函数已更新（包含去重逻辑）';
  ELSE
    RAISE NOTICE '❌ insert_candidate_with_embedding 函数更新失败';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_duplicate_candidates') THEN
    RAISE NOTICE '✅ cleanup_duplicate_candidates 辅助函数已创建';
  ELSE
    RAISE NOTICE '❌ cleanup_duplicate_candidates 辅助函数创建失败';
  END IF;
  
  -- 检查索引是否创建成功
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_deduplication') THEN
    RAISE NOTICE '✅ 去重查询索引已创建';
  ELSE
    RAISE NOTICE '❌ 去重查询索引创建失败';
  END IF;
  
  RAISE NOTICE '🎉 候选人去重逻辑实施完成！';
  RAISE NOTICE '📝 使用说明：';
  RAISE NOTICE '   - insert_candidate_with_embedding 函数现在会自动检查重复';
  RAISE NOTICE '   - 重复标准：owner_id + name + email + phone';
  RAISE NOTICE '   - 如果重复：更新现有记录';
  RAISE NOTICE '   - 如果不重复：创建新记录';
  RAISE NOTICE '   - 运行 SELECT * FROM cleanup_duplicate_candidates() 清理现有重复数据';
END $$; 