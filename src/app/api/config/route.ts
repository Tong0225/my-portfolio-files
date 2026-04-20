import { NextRequest, NextResponse } from 'next/server';

const GITHUB_OWNER = 'Tong0225';
const GITHUB_REPO = 'my-portfolio-files';
const GITHUB_BRANCH = 'main';
const CONFIG_PATH = 'data/config.json';

async function githubRequest(endpoint: string, options: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured');
  }
  
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

async function getFileContent(filePath: string): Promise<string | null> {
  try {
    const data = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`);
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

async function saveFileContent(filePath: string, content: string, message: string) {
  const existing = await getFileContent(filePath);
  const encoded = Buffer.from(content).toString('base64');
  
  const body: Record<string, unknown> = {
    message,
    content: encoded,
    branch: GITHUB_BRANCH,
  };
  
  if (existing !== null) {
    const currentData = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`);
    body.sha = currentData.sha;
  }
  
  return githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

interface Config {
  siteTitle: string;
  siteDescription: string;
  adminPassword: string;
  requirePasswordLogin: boolean;
  requirePasswordUpload: boolean;
  requirePasswordDelete: boolean;
  categories: Record<string, string[]>;
}

const DEFAULT_CONFIG: Config = {
  siteTitle: '个人作品展示',
  siteDescription: '记录每一个创意瞬间',
  adminPassword: 'admin123',
  requirePasswordLogin: true,
  requirePasswordUpload: true,
  requirePasswordDelete: true,
  categories: {
    '设计作品': ['海报设计', 'UI设计', '平面设计'],
    '视频作品': ['宣传片', '短片', '微电影'],
    '文档资料': ['策划案', '方案', '报告']
  }
};

// GET - 获取配置
export async function GET() {
  try {
    const content = await getFileContent(CONFIG_PATH);
    const config: Config = content ? JSON.parse(content) : DEFAULT_CONFIG;
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json({ success: true, config: DEFAULT_CONFIG });
  }
}

// POST - 验证密码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.password !== undefined) {
      const content = await getFileContent(CONFIG_PATH);
      const config: Config = content ? JSON.parse(content) : DEFAULT_CONFIG;
      return NextResponse.json({ valid: body.password === config.adminPassword });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Verify password error:', error);
    return NextResponse.json({ valid: false });
  }
}

// PUT - 保存配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    let config: Config;
    const existingContent = await getFileContent(CONFIG_PATH);
    config = existingContent ? { ...JSON.parse(existingContent), ...body } : { ...DEFAULT_CONFIG, ...body };
    
    await saveFileContent(CONFIG_PATH, JSON.stringify(config, null, 2), 'Update config');
    
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Save config error:', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}
