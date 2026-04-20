import { NextRequest, NextResponse } from 'next/server';

const GITHUB_OWNER = 'Tong0225';
const GITHUB_REPO = 'my-portfolio-files';
const GITHUB_BRANCH = 'main';
const WORKS_PATH = 'data/works.json';

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

interface Work {
  id: string;
  title: string;
  description: string;
  mainCategory: string;
  subCategory: string;
  type: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  videoPlatform?: string;
  createdAt: number;
  updatedAt: number;
}

// GET - 获取所有作品
export async function GET() {
  try {
    const content = await getFileContent(WORKS_PATH);
    const works: Work[] = content ? JSON.parse(content) : [];
    return NextResponse.json({ success: true, works });
  } catch (error) {
    console.error('Get works error:', error);
    return NextResponse.json({ success: true, works: [] });
  }
}

// POST - 添加/更新作品
export async function POST(request: NextRequest) {
  try {
    const work: Work = await request.json();
    
    if (!work.title || !work.mainCategory || !work.type) {
      return NextResponse.json({ success: false, error: '缺少必要字段' }, { status: 400 });
    }
    
    let works: Work[] = [];
    const existingContent = await getFileContent(WORKS_PATH);
    if (existingContent) {
      works = JSON.parse(existingContent);
    }
    
    const existingIndex = works.findIndex(w => w.id === work.id);
    let savedWork: Work;
    
    if (existingIndex >= 0) {
      works[existingIndex] = { ...work, updatedAt: Date.now() };
      savedWork = works[existingIndex];
    } else {
      savedWork = { ...work, createdAt: Date.now(), updatedAt: Date.now() };
      works.unshift(savedWork);
    }
    
    await saveFileContent(WORKS_PATH, JSON.stringify(works, null, 2), 'Update works');
    
    return NextResponse.json({ success: true, work: savedWork });
  } catch (error) {
    console.error('Add work error:', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}

// DELETE - 删除作品
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少ID' }, { status: 400 });
    }
    
    const content = await getFileContent(WORKS_PATH);
    if (!content) {
      return NextResponse.json({ success: false, error: '数据不存在' }, { status: 404 });
    }
    
    let works: Work[] = JSON.parse(content);
    works = works.filter(w => w.id !== id);
    
    await saveFileContent(WORKS_PATH, JSON.stringify(works, null, 2), 'Delete work');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete work error:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
