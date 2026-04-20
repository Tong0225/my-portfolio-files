import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORKS_FILE = path.join(DATA_DIR, 'works.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

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

interface Config {
  siteTitle: string;
  siteDescription: string;
  adminPassword: string;
  requirePasswordLogin: boolean;
  requirePasswordUpload: boolean;
  requirePasswordDelete: boolean;
  categories: Record<string, string[]>;
  githubRepo?: string;  // GitHub仓库信息
  githubToken?: string;  // GitHub Token
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function getConfig(): Promise<Config> {
  await ensureDataDir();
  const defaultConfig: Config = {
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
  
  if (!existsSync(CONFIG_FILE)) {
    await writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  
  const data = await readFile(CONFIG_FILE, 'utf-8');
  return { ...defaultConfig, ...JSON.parse(data) };
}

// 获取所有作品
export async function GET() {
  try {
    await ensureDataDir();
    if (!existsSync(WORKS_FILE)) {
      return NextResponse.json({ success: true, works: [] });
    }
    const data = await readFile(WORKS_FILE, 'utf-8');
    return NextResponse.json({ success: true, works: JSON.parse(data) });
  } catch (error) {
    console.error('Get works error:', error);
    return NextResponse.json({ success: false, error: '获取作品失败' }, { status: 500 });
  }
}

// 添加作品
export async function POST(request: NextRequest) {
  try {
    const work = await request.json() as Work;
    
    if (!work.title || !work.mainCategory || !work.type) {
      return NextResponse.json({ success: false, error: '缺少必要字段' }, { status: 400 });
    }
    
    await ensureDataDir();
    let works: Work[] = [];
    if (existsSync(WORKS_FILE)) {
      const data = await readFile(WORKS_FILE, 'utf-8');
      works = JSON.parse(data);
    }
    
    const newWork: Work = {
      id: work.id || `work_${randomUUID()}`,
      title: work.title,
      description: work.description || '',
      mainCategory: work.mainCategory,
      subCategory: work.subCategory || '',
      type: work.type,
      fileUrl: work.fileUrl || '',
      fileName: work.fileName || '',
      fileSize: work.fileSize || 0,
      videoPlatform: work.videoPlatform,
      createdAt: work.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    // 检查是否编辑现有作品
    const existingIndex = works.findIndex(w => w.id === newWork.id);
    if (existingIndex >= 0) {
      works[existingIndex] = newWork;
    } else {
      works.unshift(newWork);
    }
    
    await writeFile(WORKS_FILE, JSON.stringify(works, null, 2));
    return NextResponse.json({ success: true, work: newWork });
  } catch (error) {
    console.error('Add work error:', error);
    return NextResponse.json({ success: false, error: '添加作品失败' }, { status: 500 });
  }
}

// 删除作品
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少作品ID' }, { status: 400 });
    }
    
    await ensureDataDir();
    if (!existsSync(WORKS_FILE)) {
      return NextResponse.json({ success: false, error: '作品不存在' }, { status: 404 });
    }
    
    const data = await readFile(WORKS_FILE, 'utf-8');
    let works: Work[] = JSON.parse(data);
    works = works.filter(w => w.id !== id);
    await writeFile(WORKS_FILE, JSON.stringify(works, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete work error:', error);
    return NextResponse.json({ success: false, error: '删除作品失败' }, { status: 500 });
  }
}
