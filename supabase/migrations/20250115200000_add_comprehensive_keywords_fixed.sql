-- 添加全面的公司和学历院校关键词
-- Migration: Add Comprehensive Keywords (Companies & Universities) - Fixed
-- Created: 2025-01-15 20:00:00

-- 确保关键词库表存在
CREATE TABLE IF NOT EXISTS keyword_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'company', 'skill', 'position', 'industry', 'education'
  weight REAL DEFAULT 1.0, -- 关键词权重
  aliases TEXT[], -- 同义词/别名
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加中国公司关键词
INSERT INTO keyword_library (keyword, category, weight, aliases) VALUES
-- 传统互联网巨头
('腾讯', 'company', 1.2, ARRAY['腾讯科技', 'Tencent', 'QQ', '微信', '腾讯控股', '腾讯公司']),
('阿里巴巴', 'company', 1.2, ARRAY['阿里', 'Alibaba', '淘宝', '天猫', '支付宝', '阿里云', '阿里集团']),
('字节跳动', 'company', 1.2, ARRAY['字节', 'ByteDance', '抖音', 'TikTok', '今日头条', '字节跳动科技']),
('华为', 'company', 1.2, ARRAY['Huawei', '华为技术', '华为技术有限公司', '华为公司']),
('美团', 'company', 1.2, ARRAY['美团点评', 'Meituan', '美团外卖', '美团网']),
('京东', 'company', 1.1, ARRAY['JD', 'JD.com', '京东商城', '京东科技', '京东集团']),
('百度', 'company', 1.2, ARRAY['Baidu', '百度科技', '百度在线', '百度公司']),
('网易', 'company', 1.1, ARRAY['NetEase', '网易游戏', '网易云音乐', '网易公司']),
('滴滴', 'company', 1.1, ARRAY['滴滴出行', 'DiDi', '滴滴网约车', '滴滴科技']),
('快手', 'company', 1.1, ARRAY['Kuaishou', '快手科技']),
('拼多多', 'company', 1.1, ARRAY['Pinduoduo', 'PDD']),

-- AI独角兽公司
('智谱AI', 'company', 1.4, ARRAY['智谱', 'Zhipu', 'Zhipu AI', '智谱科技', 'GLM', 'ChatGLM']),
('月之暗面', 'company', 1.4, ARRAY['Moonshot AI', 'Kimi', 'moonshot', '月之暗面科技']),
('百川智能', 'company', 1.4, ARRAY['百川', 'Baichuan', 'Baichuan AI', '百川AI']),
('MiniMax', 'company', 1.4, ARRAY['minimax', 'Mini Max', 'MiniMax科技']),
('零一万物', 'company', 1.4, ARRAY['01.AI', '01AI', '零一万物科技']),
('商汤科技', 'company', 1.4, ARRAY['商汤', 'SenseTime', '商汤AI']),
('旷视科技', 'company', 1.4, ARRAY['旷视', 'Face++', 'Megvii']),
('第四范式', 'company', 1.3, ARRAY['4Paradigm', '第四范式科技']),
('云从科技', 'company', 1.3, ARRAY['云从', 'CloudWalk']),
('依图科技', 'company', 1.3, ARRAY['依图', 'Yitu']),
('明略科技', 'company', 1.3, ARRAY['明略', 'Mininglamp', '明略数据']),
('地平线', 'company', 1.3, ARRAY['地平线机器人', 'Horizon Robotics']),
('寒武纪', 'company', 1.3, ARRAY['寒武纪科技', 'Cambricon']),

-- 具身智能/机器人公司
('优必选', 'company', 1.5, ARRAY['优必选科技', 'UBTech', '优必选机器人']),
('大疆', 'company', 1.4, ARRAY['大疆创新', 'DJI', '大疆科技']),
('宇树科技', 'company', 1.3, ARRAY['宇树', 'Unitree Robotics', 'Unitree']),
('智元机器人', 'company', 1.3, ARRAY['智元', 'Agibot', '智元科技']),
('科沃斯', 'company', 1.3, ARRAY['科沃斯机器人', 'Ecovacs']),
('石头科技', 'company', 1.3, ARRAY['石头', 'Roborock']),
('新松机器人', 'company', 1.2, ARRAY['新松', 'Siasun']),

-- 自动驾驶公司
('小鹏', 'company', 1.3, ARRAY['小鹏汽车', 'XPeng', '小鹏科技']),
('蔚来', 'company', 1.3, ARRAY['NIO', '蔚来汽车']),
('理想', 'company', 1.3, ARRAY['理想汽车', 'Li Auto']),
('文远知行', 'company', 1.3, ARRAY['WeRide', 'WeRide.ai']),
('小马智行', 'company', 1.3, ARRAY['Pony.ai', '小马智卡']),
('毫末智行', 'company', 1.3, ARRAY['毫末', 'Haomo.ai', '毫末科技']),
('AutoX', 'company', 1.3, ARRAY['安途智行', 'AutoX科技']),

-- 其他知名公司
('米哈游', 'company', 1.2, ARRAY['miHoYo', '米哈游科技']),
('莉莉丝游戏', 'company', 1.2, ARRAY['Lilith Games', '莉莉丝']),
('小红书', 'company', 1.1, ARRAY['Xiaohongshu', '小红书科技']),
('哔哩哔哩', 'company', 1.1, ARRAY['Bilibili', 'B站', 'bilibili']),
('PingCAP', 'company', 1.2, ARRAY['pingcap', 'PingCap']),
('声网', 'company', 1.1, ARRAY['Agora', '声网科技']),
('得物', 'company', 1.1, ARRAY['Poizon', '得物App']),
('携程', 'company', 1.1, ARRAY['Trip.com', '携程网', 'Ctrip'])

ON CONFLICT (keyword) DO NOTHING;

-- 添加国际/跨国公司关键词
INSERT INTO keyword_library (keyword, category, weight, aliases) VALUES
('Apple', 'company', 1.3, ARRAY['苹果', 'Apple Inc', '苹果公司']),
('Microsoft', 'company', 1.3, ARRAY['微软', 'MSFT', '微软公司']),
('Google', 'company', 1.3, ARRAY['谷歌', 'Alphabet', 'Google Inc']),
('Amazon', 'company', 1.3, ARRAY['亚马逊', 'AWS', 'Amazon Web Services']),
('Meta', 'company', 1.3, ARRAY['Facebook', 'Meta Platforms', 'FB']),
('NVIDIA', 'company', 1.4, ARRAY['英伟达', 'NVDA', 'Nvidia']),
('Tesla', 'company', 1.4, ARRAY['特斯拉', 'Tesla Inc', 'Tesla Motors']),
('Intel', 'company', 1.2, ARRAY['英特尔', 'Intel Corp']),
('AMD', 'company', 1.2, ARRAY['超威半导体', 'Advanced Micro Devices']),
('Qualcomm', 'company', 1.2, ARRAY['高通', '高通公司']),
('TSMC', 'company', 1.2, ARRAY['台积电', '台湾积体电路制造', 'Taiwan Semiconductor']),
('OpenAI', 'company', 1.5, ARRAY['openai', 'Open AI', 'ChatGPT公司', 'GPT开发商']),
('Boston Dynamics', 'company', 1.4, ARRAY['波士顿动力', 'BD', 'Atlas机器人']),
('Salesforce', 'company', 1.2, ARRAY['赛富时', 'CRM']),
('Oracle', 'company', 1.1, ARRAY['甲骨文', 'Oracle Corp']),
('SAP', 'company', 1.1, ARRAY['思爱普', 'SAP SE']),
('McKinsey', 'company', 1.3, ARRAY['麦肯锡', 'McKinsey & Company', '麦肯锡咨询']),
('BCG', 'company', 1.3, ARRAY['波士顿咨询', 'Boston Consulting Group']),
('Bain', 'company', 1.3, ARRAY['贝恩', 'Bain & Company', '贝恩咨询'])

ON CONFLICT (keyword) DO NOTHING;

-- 添加学位关键词
INSERT INTO keyword_library (keyword, category, weight, aliases) VALUES
('博士', 'education', 1.4, ARRAY['PhD', 'Doctorate', '博士学位', 'Doctor', 'Ph.D.']),
('硕士', 'education', 1.3, ARRAY['Master', '硕士学位', 'Masters', 'Master''s', 'MSc', 'MA', 'MS']),
('本科', 'education', 1.2, ARRAY['Bachelor', '学士', '学士学位', 'Bachelor''s', 'BSc', 'BA', 'BS'])

ON CONFLICT (keyword) DO NOTHING;

-- 添加国内院校关键词
INSERT INTO keyword_library (keyword, category, weight, aliases) VALUES
-- 顶尖985院校
('清华大学', 'education', 1.5, ARRAY['清华', 'Tsinghua', 'THU']),
('北京大学', 'education', 1.5, ARRAY['北大', 'Peking University', 'PKU']),
('上海交通大学', 'education', 1.4, ARRAY['上海交大', 'SJTU', '交大', '上交']),
('复旦大学', 'education', 1.4, ARRAY['复旦', 'Fudan']),
('浙江大学', 'education', 1.4, ARRAY['浙大', 'ZJU']),
('中国科学技术大学', 'education', 1.4, ARRAY['中科大', 'USTC', '中国科大', '科大']),
('南京大学', 'education', 1.4, ARRAY['南大', 'NJU']),
('哈尔滨工业大学', 'education', 1.3, ARRAY['哈工大', 'HIT', '哈尔滨工大']),
('西安交通大学', 'education', 1.3, ARRAY['西安交大', 'XJTU', '西交']),
('北京航空航天大学', 'education', 1.3, ARRAY['北航', 'Beihang', 'BUAA']),
('北京邮电大学', 'education', 1.3, ARRAY['北邮', 'BUPT']),
('华中科技大学', 'education', 1.3, ARRAY['华中科大', 'HUST', '华科']),
('电子科技大学', 'education', 1.3, ARRAY['电子科大', 'UESTC', '成电']),
('武汉大学', 'education', 1.3, ARRAY['武大', 'WHU']),
('中山大学', 'education', 1.3, ARRAY['中大', 'SYSU']),
('中国人民大学', 'education', 1.3, ARRAY['人大', 'RUC', '中国人大']),

-- 香港院校
('香港大学', 'education', 1.4, ARRAY['港大', 'HKU', 'University of Hong Kong']),
('香港科技大学', 'education', 1.4, ARRAY['港科大', 'HKUST', 'Hong Kong University of Science and Technology']),
('香港中文大学', 'education', 1.4, ARRAY['港中大', 'CUHK', 'Chinese University of Hong Kong'])

ON CONFLICT (keyword) DO NOTHING;

-- 添加国际院校关键词
INSERT INTO keyword_library (keyword, category, weight, aliases) VALUES
-- 美国顶尖院校
('Massachusetts Institute of Technology', 'education', 1.5, ARRAY['MIT', '麻省理工', '麻省理工学院']),
('Stanford University', 'education', 1.5, ARRAY['Stanford', '斯坦福', '斯坦福大学']),
('Carnegie Mellon University', 'education', 1.5, ARRAY['CMU', 'Carnegie Mellon', '卡内基梅隆', '卡梅']),
('University of California, Berkeley', 'education', 1.4, ARRAY['UC Berkeley', 'Berkeley', '伯克利', '加州大学伯克利分校']),
('Harvard University', 'education', 1.5, ARRAY['Harvard', '哈佛', '哈佛大学']),
('Princeton University', 'education', 1.4, ARRAY['Princeton', '普林斯顿', '普林斯顿大学']),
('Yale University', 'education', 1.4, ARRAY['Yale', '耶鲁', '耶鲁大学']),
('Columbia University', 'education', 1.4, ARRAY['Columbia', '哥伦比亚', '哥伦比亚大学']),
('University of Pennsylvania', 'education', 1.4, ARRAY['UPenn', 'Penn', '宾夕法尼亚大学', '宾大']),
('University of California, Los Angeles', 'education', 1.3, ARRAY['UCLA', '加州大学洛杉矶分校']),
('University of Illinois Urbana-Champaign', 'education', 1.3, ARRAY['UIUC', '伊利诺伊大学香槟分校']),
('University of Washington', 'education', 1.3, ARRAY['UW', '华盛顿大学']),
('Georgia Institute of Technology', 'education', 1.3, ARRAY['Georgia Tech', 'GT', '佐治亚理工']),
('University of Michigan', 'education', 1.3, ARRAY['UMich', '密歇根大学']),

-- 英国院校
('University of Cambridge', 'education', 1.5, ARRAY['Cambridge', '剑桥', '剑桥大学']),
('University of Oxford', 'education', 1.5, ARRAY['Oxford', '牛津', '牛津大学']),
('Imperial College London', 'education', 1.4, ARRAY['IC', 'Imperial', '帝国理工', '帝国理工学院']),
('London School of Economics', 'education', 1.4, ARRAY['LSE', '伦敦政经', '伦敦政治经济学院']),
('University College London', 'education', 1.4, ARRAY['UCL', '伦敦大学学院']),

-- 欧洲院校
('ETH Zurich', 'education', 1.4, ARRAY['苏黎世联邦理工', 'ETH', 'Swiss Federal Institute']),
('EPFL', 'education', 1.4, ARRAY['洛桑联邦理工', 'École Polytechnique Fédérale de Lausanne']),
('Technical University of Munich', 'education', 1.3, ARRAY['TUM', '慕尼黑工业大学', 'TU Munich']),

-- 亚洲院校
('National University of Singapore', 'education', 1.4, ARRAY['NUS', '新加坡国立', '新加坡国立大学']),
('Nanyang Technological University', 'education', 1.4, ARRAY['NTU', '南洋理工', '南洋理工大学']),
('The University of Tokyo', 'education', 1.4, ARRAY['東京大学', '东京大学', 'UTokyo']),

-- 加拿大院校
('University of Toronto', 'education', 1.4, ARRAY['UofT', '多伦多大学']),
('University of Waterloo', 'education', 1.4, ARRAY['Waterloo', '滑铁卢大学']),
('McGill University', 'education', 1.3, ARRAY['McGill', '麦吉尔大学'])

ON CONFLICT (keyword) DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_keyword_library_category ON keyword_library(category);
CREATE INDEX IF NOT EXISTS idx_keyword_library_weight ON keyword_library(weight);
CREATE INDEX IF NOT EXISTS idx_keyword_library_active ON keyword_library(is_active);
CREATE INDEX IF NOT EXISTS idx_keyword_library_aliases ON keyword_library USING GIN(aliases);

-- 为关键词库添加注释
COMMENT ON TABLE keyword_library IS '智能关键词库 - 存储公司、技能、职位、行业和教育背景的关键词及其权重';
COMMENT ON COLUMN keyword_library.keyword IS '主关键词';
COMMENT ON COLUMN keyword_library.category IS '关键词类别: company, skill, position, industry, education';
COMMENT ON COLUMN keyword_library.weight IS '权重值，用于搜索结果排序提升';
COMMENT ON COLUMN keyword_library.aliases IS '同义词和别名数组';
COMMENT ON COLUMN keyword_library.is_active IS '是否启用该关键词'; 