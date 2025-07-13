-- 更新RLS策略，实现数据共享模式
-- 允许所有认证用户访问数据

-- 删除现有的RLS策略
DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON jobs;

-- 创建新的共享访问策略 - 简历表
CREATE POLICY "Authenticated users can view all resumes"
  ON resumes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert resumes"
  ON resumes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all resumes"
  ON resumes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all resumes"
  ON resumes FOR DELETE
  TO authenticated
  USING (true);

-- 创建新的共享访问策略 - 职位表
CREATE POLICY "Authenticated users can view all jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (true); 