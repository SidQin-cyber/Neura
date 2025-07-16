-- =========================================
-- 添加Job岗位录入的关键字段以提升AI搜索质量
-- 这些字段是向量化和rerank的核心数据源
-- =========================================

-- 1. 添加岗位亮点总结字段 (AI语义搜索的灵魂)
-- 这是rerank模型理解岗位"吸引力"的最重要信息
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS job_summary TEXT;

-- 2. 添加团队信息字段 (团队规模、背景、氛围)
-- 帮助候选人了解将要加入的团队
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS team_info JSONB;

-- 3. 添加成长机会数组 (职业发展路径)
-- 吸引有上进心的候选人
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS growth_opportunities TEXT[];

-- 4. 添加工作环境描述 (办公环境、工作氛围)
-- 让候选人对工作环境有清晰预期
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS work_environment TEXT;

-- 5. 添加公司文化描述 (价值观、文化特色)
-- 帮助文化匹配
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS company_culture TEXT;

-- 6. 添加远程工作政策 (混合办公、纯远程等)
-- 现代工作模式的重要信息
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS remote_policy TEXT;

-- 7. 添加面试流程信息 (面试轮次、形式、时长)
-- 帮助候选人做好面试准备
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS interview_process JSONB;

-- 8. 添加联系人信息 (HR、直属领导等)
-- 方便候选人咨询和沟通
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS contact_info JSONB;

-- 9. 添加紧急程度 (急招、普通、储备)
-- 帮助优先级管理
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'normal' 
CHECK (urgency_level IN ('urgent', 'normal', 'pipeline'));

-- 10. 添加期望入职时间
-- 时间规划重要信息
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS expected_start_date DATE;

-- 为新字段添加注释说明用途
COMMENT ON COLUMN jobs.job_summary IS '岗位亮点总结，2-3句描述岗位核心价值和吸引力的高质量文本，用于AI语义理解';
COMMENT ON COLUMN jobs.team_info IS '团队信息JSON，包含团队规模、成员背景、团队氛围等';
COMMENT ON COLUMN jobs.growth_opportunities IS '成长机会数组，如["技术专家路线", "管理路线", "跨部门轮岗"]';
COMMENT ON COLUMN jobs.work_environment IS '工作环境描述，包括办公环境、工作氛围、设备配置等';
COMMENT ON COLUMN jobs.company_culture IS '公司文化描述，体现价值观和文化特色';
COMMENT ON COLUMN jobs.remote_policy IS '远程工作政策，如"灵活混合办公"、"纯远程"、"现场办公"等';
COMMENT ON COLUMN jobs.interview_process IS '面试流程JSON，包含面试轮次、形式、预期时长等';
COMMENT ON COLUMN jobs.contact_info IS '联系人信息JSON，包含HR和直属领导的联系方式';
COMMENT ON COLUMN jobs.urgency_level IS '招聘紧急程度：urgent(急招)、normal(正常)、pipeline(人才储备)';
COMMENT ON COLUMN jobs.expected_start_date IS '期望入职时间';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_jobs_growth_opportunities ON jobs USING GIN (growth_opportunities);
CREATE INDEX IF NOT EXISTS idx_jobs_team_info ON jobs USING GIN (team_info);
CREATE INDEX IF NOT EXISTS idx_jobs_interview_process ON jobs USING GIN (interview_process);
CREATE INDEX IF NOT EXISTS idx_jobs_contact_info ON jobs USING GIN (contact_info);
CREATE INDEX IF NOT EXISTS idx_jobs_urgency_level ON jobs (urgency_level);
CREATE INDEX IF NOT EXISTS idx_jobs_expected_start_date ON jobs (expected_start_date);

-- 验证字段添加成功
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('job_summary', 'team_info', 'growth_opportunities', 'work_environment', 'company_culture', 'remote_policy', 'interview_process', 'contact_info', 'urgency_level', 'expected_start_date')
ORDER BY column_name; 