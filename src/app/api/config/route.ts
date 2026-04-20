import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

interface Config {
  siteTitle: string;
  siteDescription: string;
  adminPassword: string;
  requirePasswordLogin: boolean;
  requirePasswordUpload: boolean;
  requirePasswordDelete: boolean;
  categories: Record<string, string[]>;
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

async function saveConfig(config: Config) {
  await ensureDataDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 获取配置
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// 保存配置
export async function PUT(request: NextRequest) {
  try {
    const config = await request.json() as Partial<Config>;
    const currentConfig = await getConfig();
    const newConfig = { ...currentConfig, ...config };
    await saveConfig(newConfig);
    return NextResponse.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Save config error:', error);
    return NextResponse.json(
      { success: false, error: '保存配置失败' },
      { status: 500 }
    );
  }
}

// 验证密码
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json() as { password: string };
    const config = await getConfig();
    
    if (password === config.adminPassword) {
      return NextResponse.json({ success: true, valid: true });
    }
    
    return NextResponse.json({ success: true, valid: false });
  } catch (error) {
    console.error('Verify password error:', error);
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    );
  }
}
