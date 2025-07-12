-- 修复RLS策略，允许用户操作自己的数据

-- 1. 删除现有的策略（如果存在）
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON jobs;

-- 2. 为resumes表创建新的RLS策略
CREATE POLICY "Users can insert their own resumes"
ON resumes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their own resumes"
ON resumes FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own resumes"
ON resumes FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own resumes"
ON resumes FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- 3. 为jobs表创建新的RLS策略
CREATE POLICY "Users can insert their own jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their own jobs"
ON jobs FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own jobs"
ON jobs FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own jobs"
ON jobs FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- 4. 确保RLS已启用
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 5. 检查策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('resumes', 'jobs')
ORDER BY tablename, policyname; 