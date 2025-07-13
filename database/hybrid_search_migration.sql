-- 混合搜索数据库迁移
-- 日期: 2024-12-06
-- 功能: 为resumes和jobs表添加全文搜索支持，实现向量搜索+关键词搜索的混合模式

-- ① 为 resumes / jobs 添加 tsvector 列
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS fts_document tsvector;
ALTER TABLE jobs    ADD COLUMN IF NOT EXISTS fts_document tsvector;

-- ② 触发器：自动维护 fts_document
CREATE OR REPLACE FUNCTION update_resume_fts_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_document :=
    to_tsvector('chinese_zh',
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.current_title, '') || ' ' ||
      coalesce(NEW.current_company, '') || ' ' ||
      coalesce(NEW.location, '') || ' ' ||
      array_to_string(coalesce(NEW.skills,  ARRAY[]::text[]), ' ')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_job_fts_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_document :=
    to_tsvector('chinese_zh',
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.company, '') || ' ' ||
      coalesce(NEW.location, '') || ' ' ||
      array_to_string(coalesce(NEW.skills_required, ARRAY[]::text[]), ' ')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvector_update ON resumes;
CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON resumes
FOR EACH ROW EXECUTE FUNCTION update_resume_fts_document();

DROP TRIGGER IF EXISTS tsvector_update ON jobs;
CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION update_job_fts_document();

-- ③ 为 tsvector 列建 GIN 索引（加速全文检索）
CREATE INDEX IF NOT EXISTS idx_resumes_fts_document ON resumes USING GIN(fts_document);
CREATE INDEX IF NOT EXISTS idx_jobs_fts_document    ON jobs    USING GIN(fts_document);

-- ④ 为现有数据初始化 fts_document（触发器执行）
-- 这会为所有现有记录生成全文搜索文档
UPDATE resumes SET id = id WHERE fts_document IS NULL;
UPDATE jobs SET id = id WHERE fts_document IS NULL;

-- ⑤ 创建辅助函数：标准化查询文本
CREATE OR REPLACE FUNCTION normalize_search_query(query_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- 移除特殊字符，保留中文、英文、数字和空格
  RETURN regexp_replace(query_text, '[^\u4e00-\u9fa5a-zA-Z0-9\s]', ' ', 'g');
END;
$$; 