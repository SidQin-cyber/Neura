export type Language = 'en' | 'zh-CN'

export const translations = {
  en: {
    // Header and Navigation
    'header.title': 'Neura',
    'nav.newChat': 'New chat',
    'nav.upload': 'Upload',
    
    // User Menu
    'menu.language': 'Language',
    'menu.links': 'Links',
    'menu.logout': 'Logout',
    
    // Language Options
    'language.english': 'English',
    'language.chinese': 'Simplified Chinese',
    
    // Chat Interface
    'chat.greeting.title': 'Hi, I\'m Neura.',
    'chat.greeting.subtitle': 'Let\'s find your perfect candidate.',
    'chat.placeholder.candidates': 'Describe the candidate you\'re looking for, e.g., 5 years Java developer in Beijing...',
    'chat.placeholder.jobs': 'Describe the position you want to match, e.g., Senior Frontend Engineer, React, 15-25K...',
    
    // Search Results
    'search.found.candidates': 'Found {{count}} candidates',
    'search.found.jobs': 'Found {{count}} positions',
    'search.noResults.candidates': 'No matching candidates found, try adjusting search criteria.',
    'search.noResults.jobs': 'No matching positions found, try adjusting search criteria.',
    
    // Mode Switcher
    'mode.candidates': 'Find Candidates',
    'mode.jobs': 'Find Jobs',
    'mode.searchMode': 'Search Mode',
    'mode.currentMode': 'Current search mode',
    
    // Filters
    'filter.advanced': 'Advanced Filter',
    'filter.location': 'Location',
    'filter.education': 'Education',
    'filter.salary': 'Salary Range',
    'filter.salary.expected': 'Expected Salary (Monthly, K)',
    'filter.salary.offered': 'Offered Salary (Monthly, K)',
    'filter.education.unlimited': 'Unlimited',
    'filter.education.highschool': 'High School',
    'filter.education.junior': 'Junior College',
    'filter.education.bachelor': 'Bachelor',
    'filter.education.master': 'Master',
    'filter.education.doctor': 'Doctor',
    'filter.reset': 'Reset',
    'filter.apply': 'Apply Filter',
    
    // Upload
    'upload.title': 'Upload Data',
    'upload.candidates': 'Upload Candidates JSON',
    'upload.jobs': 'Upload Jobs JSON',
    'upload.dragText': 'Drag JSON files here, or click to select files',
    'upload.supportText': 'Supports .json format files (single object or array)',
    'upload.pasteText': 'Or paste JSON data directly:',
    'upload.placeholder.candidates': 'Please enter candidate JSON data (supports single object or array)...',
    'upload.placeholder.jobs': 'Please enter job JSON data (supports single object or array)...',
    'upload.confirm': 'Confirm Upload',
    'upload.cancel': 'Cancel',
    'upload.clear': 'Clear',
    
    // Buttons
    'button.search': 'Search',
    'button.stop': 'Stop',
    'button.showMore': 'Show More ({{count}})',
    'button.showLess': 'Show Less',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error occurred',
  },
  'zh-CN': {
    // Header and Navigation
    'header.title': 'Neura',
    'nav.newChat': '新建对话',
    'nav.upload': '上传',
    
    // User Menu
    'menu.language': '语言',
    'menu.links': '链接',
    'menu.logout': '退出登录',
    
    // Language Options
    'language.english': 'English',
    'language.chinese': '简体中文',
    
    // Chat Interface
    'chat.greeting.title': 'Hi, I\'m Neura.',
    'chat.greeting.subtitle': 'Let\'s find your perfect candidate.',
    'chat.placeholder.candidates': '描述你要找的候选人，例如：5年Java开发经验，熟悉Spring框架，在北京...',
    'chat.placeholder.jobs': '描述你要匹配的职位，例如：高级前端工程师，React开发，15-25K...',
    
    // Search Results
    'search.found.candidates': '找到 {{count}} 位候选人',
    'search.found.jobs': '找到 {{count}} 个职位',
    'search.noResults.candidates': '未找到匹配的候选人，尝试调整搜索条件。',
    'search.noResults.jobs': '未找到匹配的职位，尝试调整搜索条件。',
    
    // Mode Switcher
    'mode.candidates': '寻找候选人',
    'mode.jobs': '寻找职位',
    'mode.searchMode': '搜索模式',
    'mode.currentMode': '当前搜索模式',
    
    // Filters
    'filter.advanced': '高级筛选',
    'filter.location': '地点',
    'filter.education': '学历',
    'filter.salary': '薪资范围',
    'filter.salary.expected': '薪酬预期 (月薪, K)',
    'filter.salary.offered': '薪酬预期 (月薪, K)',
    'filter.education.unlimited': '不限',
    'filter.education.highschool': '高中',
    'filter.education.junior': '大专',
    'filter.education.bachelor': '本科',
    'filter.education.master': '硕士',
    'filter.education.doctor': '博士',
    'filter.reset': '重置',
    'filter.apply': '应用筛选',
    
    // Upload
    'upload.title': '上传数据',
    'upload.candidates': '上传人选JSON',
    'upload.jobs': '上传职位JSON',
    'upload.dragText': '拖拽JSON文件到此处，或点击选择文件',
    'upload.supportText': '支持.json格式文件（单个对象或数组）',
    'upload.pasteText': '或直接粘贴JSON数据：',
    'upload.placeholder.candidates': '请输入人选JSON数据（支持单个对象或数组）...',
    'upload.placeholder.jobs': '请输入职位JSON数据（支持单个对象或数组）...',
    'upload.confirm': '确认上传',
    'upload.cancel': '取消',
    'upload.clear': '清空',
    
    // Buttons
    'button.search': '搜索',
    'button.stop': '停止',
    'button.showMore': '显示更多 ({{count}} 个)',
    'button.showLess': '收起部分结果',
    
    // Common
    'common.loading': '加载中...',
    'common.error': '出现错误',
  }
}

export type TranslationKey = keyof typeof translations.en

export function getTranslation(language: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text = translations[language][key] || translations['zh-CN'][key] || key
  
  // Replace parameters in translation
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
    })
  }
  
  return text
} 