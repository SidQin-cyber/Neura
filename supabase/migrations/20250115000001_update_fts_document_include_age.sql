-- 更新 FTS 文档生成函数，包含年龄字段
-- Migration: Update FTS document function to include age field
-- Created: 2025-01-15

-- 更新简历FTS文档生成函数
CREATE OR REPLACE FUNCTION update_resume_fts_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_document := to_tsvector('chinese_zh', 
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.current_title, '') || ' ' ||
    COALESCE(NEW.current_company, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(NEW.age::TEXT, '') || ' ' ||
    COALESCE(array_to_string(NEW.skills, ' '), '') || ' ' ||
    COALESCE(NEW.raw_data::TEXT, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 