#!/usr/bin/env node

/**
 * 应用混合搜索数据库迁移
 * 这个脚本会执行混合搜索所需的数据库变更
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始应用混合搜索数据库迁移...\n');

// 检查是否存在迁移文件
const migrationFile = path.join(__dirname, 'database/hybrid_search_migration.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('❌ 迁移文件不存在:', migrationFile);
  process.exit(1);
}

console.log('📋 迁移文件检查通过');

// 应用迁移
try {
  console.log('🔄 正在应用数据库迁移...');
  
  // 如果您使用的是本地 Supabase，请取消注释以下行：
  // execSync('supabase db push', { stdio: 'inherit' });
  
  // 如果您使用的是云端 Supabase，请在 SQL Editor 中手动执行迁移文件
  console.log('📝 请在 Supabase Dashboard 的 SQL Editor 中执行以下文件:');
  console.log('   database/hybrid_search_migration.sql');
  console.log('   database/rpc_functions.sql');
  
  console.log('\n✅ 数据库迁移准备完成！');
  console.log('\n📊 迁移包含以下功能:');
  console.log('   • 为 resumes 和 jobs 表添加 fts_document 列');
  console.log('   • 创建自动维护全文搜索文档的触发器');
  console.log('   • 创建 GIN 索引以加速全文搜索');
  console.log('   • 升级 RPC 函数以支持混合搜索');
  console.log('   • 添加查询文本标准化函数');
  
  console.log('\n🔧 下一步操作:');
  console.log('   1. 在 Supabase Dashboard 中执行迁移文件');
  console.log('   2. 重启应用服务器');
  console.log('   3. 测试搜索功能');
  
} catch (error) {
  console.error('❌ 迁移失败:', error.message);
  process.exit(1);
}

console.log('\n🎉 迁移脚本执行完成！'); 