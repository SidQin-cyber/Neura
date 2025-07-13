-- 添加测试数据（数据共享模式）
-- 先确保有用户记录
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change_sent_at, last_sign_in_at, confirmation_sent_at, recovery_sent_at, email_change_token_current_sent_at, email_change_token_new_sent_at, audience, phone, phone_confirmed_at, phone_change_token, phone_change_sent_at, email_change_confirm_status, banned_until, deleted_at)
VALUES 
  ('6025a859-1b92-43dc-942f-f9a75c0333e0', 'sidqin0410@neura.app', NOW(), NOW(), NOW(), '{"provider": "email", "providers": ["email"]}', '{}', false, 'authenticated', 'authenticated', '', '', '', '', null, null, null, null, null, null, null, null, null, '', null, 0, null, null),
  ('955009a6-4e03-45df-a6bd-0cff0dadd02f', 'kayqiang@neura.app', NOW(), NOW(), NOW(), '{"provider": "email", "providers": ["email"]}', '{}', false, 'authenticated', 'authenticated', '', '', '', '', null, null, null, null, null, null, null, null, null, '', null, 0, null, null)
ON CONFLICT (id) DO NOTHING;

-- 添加用户档案
INSERT INTO profiles (id, user_id, full_name, username, role, created_at, updated_at)
VALUES 
  ('6025a859-1b92-43dc-942f-f9a75c0333e0', '6025a859-1b92-43dc-942f-f9a75c0333e0', 'Sid Qin', 'sidqin', 'user', NOW(), NOW()),
  ('955009a6-4e03-45df-a6bd-0cff0dadd02f', '955009a6-4e03-45df-a6bd-0cff0dadd02f', 'Kay Qiang', 'kayqiang', 'user', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 添加测试候选人数据（注意：owner_id 现在不重要了，因为是共享数据）
INSERT INTO resumes (
  id, 
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
  status, 
  owner_id, 
  created_at, 
  updated_at
) VALUES 
  (
    '2b52fec8-8f63-41dc-acc4-af6e168e0cbc',
    '张三',
    'zhangsan@example.com',
    '13800138001',
    '全栈开发工程师',
    '深圳科技有限公司',
    '深圳',
    5,
    15000,
    25000,
    ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL'],
    '{"degree": "本科", "major": "计算机科学", "school": "深圳大学", "year": 2019}',
    '{"companies": [{"name": "深圳科技有限公司", "position": "全栈开发工程师", "duration": "2019-至今"}]}',
    '{"certs": ["AWS认证", "React开发者认证"]}',
    '{"languages": ["中文", "英文"]}',
    'active',
    '6025a859-1b92-43dc-942f-f9a75c0333e0',
    NOW(),
    NOW()
  ),
  (
    '24bb3714-1be1-4382-8e7e-e60b11362cec',
    '李四',
    'lisi@example.com',
    '13800138002',
    '前端开发工程师',
    '广州互联网公司',
    '广州',
    3,
    12000,
    18000,
    ARRAY['JavaScript', 'Vue.js', 'React', 'CSS', 'HTML', 'Webpack'],
    '{"degree": "本科", "major": "软件工程", "school": "中山大学", "year": 2021}',
    '{"companies": [{"name": "广州互联网公司", "position": "前端开发工程师", "duration": "2021-至今"}]}',
    '{"certs": ["Vue.js认证"]}',
    '{"languages": ["中文", "英文"]}',
    'active',
    '6025a859-1b92-43dc-942f-f9a75c0333e0',
    NOW(),
    NOW()
  ),
  (
    'f064ad0d-d512-4881-a4de-478ebc4f2dac',
    '王五',
    'wangwu@example.com',
    '13800138003',
    'Python后端开发工程师',
    '北京大数据公司',
    '北京',
    4,
    18000,
    28000,
    ARRAY['Python', 'Django', 'Flask', 'PostgreSQL', 'Redis', 'Docker'],
    '{"degree": "硕士", "major": "计算机技术", "school": "清华大学", "year": 2020}',
    '{"companies": [{"name": "北京大数据公司", "position": "Python后端开发工程师", "duration": "2020-至今"}]}',
    '{"certs": ["Python认证", "Docker认证"]}',
    '{"languages": ["中文", "英文"]}',
    'active',
    '6025a859-1b92-43dc-942f-f9a75c0333e0',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING; 