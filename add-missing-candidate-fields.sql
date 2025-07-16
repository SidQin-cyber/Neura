-- =========================================
-- 添加人选录入的关键字段以提升AI搜索质量
-- 这些字段是向量化和rerank的核心数据源
-- =========================================

-- 1. 添加个人简介字段 (AI语义搜索的灵魂)
-- 这是rerank模型理解候选人"气质"的最重要信息
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. 添加可接受工作地点数组 (地理位置偏好)
-- 支持"愿意去上海工作的北京工程师"这类搜索
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS relocation_preferences TEXT[];

-- 3. 添加项目经验字段 (展现技术深度和热情)
-- 工作之外的技术项目，证明候选人的技术深度
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS projects JSONB;

-- 为新字段添加注释说明用途
COMMENT ON COLUMN resumes.summary IS '候选人个人简介，3-5句描述技术背景、成就和职业目标的高质量文本，用于AI语义理解';
COMMENT ON COLUMN resumes.relocation_preferences IS '候选人可接受的工作地点数组，如[''上海'', ''深圳'']';
COMMENT ON COLUMN resumes.projects IS '项目经验JSON数组，包含项目名称、描述、技术栈等信息，展现候选人的技术深度';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_resumes_relocation_preferences ON resumes USING GIN (relocation_preferences);
CREATE INDEX IF NOT EXISTS idx_resumes_projects ON resumes USING GIN (projects);

-- 验证字段添加成功
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'resumes' 
AND column_name IN ('summary', 'relocation_preferences', 'projects')
ORDER BY column_name; 