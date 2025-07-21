-- 为 resumes 表添加年龄字段
-- Migration: Add age field to resumes table
-- Created: 2025-01-15

ALTER TABLE public.resumes 
ADD COLUMN age INTEGER;

-- 添加合理的年龄约束（18-80岁）
ALTER TABLE public.resumes 
ADD CONSTRAINT age_range_check 
CHECK (age IS NULL OR (age >= 18 AND age <= 80));

-- 为age字段添加注释
COMMENT ON COLUMN public.resumes.age IS '候选人年龄，范围18-80岁';

-- 更新现有记录的FTS文档，包含年龄信息（如果有的话）
-- 这将在下次更新记录时自动包含年龄信息 