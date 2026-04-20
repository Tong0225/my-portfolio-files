import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// 确保上传目录存在
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '没有上传文件' },
        { status: 400 }
      );
    }
    
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件太大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // 生成唯一文件名
    const ext = path.extname(file.name);
    const fileName = `${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    // 写入文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    // 返回文件访问路径
    const fileUrl = `/api/files/${fileName}`;
    
    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '上传失败' },
      { status: 500 }
    );
  }
}

// 支持大文件的分片上传
export async function PUT(request: NextRequest) {
  try {
    await ensureUploadDir();
    
    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob | null;
    const fileName = formData.get('fileName') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    
    if (!chunk || !fileName) {
      return NextResponse.json(
        { success: false, error: '缺少分片数据' },
        { status: 400 }
      );
    }
    
    // 分片文件目录
    const chunkDir = path.join(UPLOAD_DIR, 'chunks', fileName);
    await mkdir(chunkDir, { recursive: true });
    
    // 保存分片
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(chunkPath, buffer);
    
    // 检查是否所有分片都已上传
    let uploadedChunks = 0;
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(chunkDir);
      uploadedChunks = files.length;
    } catch {
      uploadedChunks = 1;
    }
    
    if (uploadedChunks === totalChunks) {
      // 合并所有分片
      const finalFileName = `${randomUUID()}_${fileName}`;
      const finalPath = path.join(UPLOAD_DIR, finalFileName);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i}`);
        const chunkData = await import('fs/promises').then(fs => fs.readFile(chunkPath));
        await import('fs/promises').then(fs => fs.appendFile(finalPath, chunkData));
        // 删除分片
        await import('fs/promises').then(fs => fs.unlink(chunkPath));
      }
      
      // 删除分片目录
      await import('fs/promises').then(fs => fs.rmdir(chunkDir));
      
      const fileUrl = `/api/files/${finalFileName}`;
      
      return NextResponse.json({
        success: true,
        file: {
          name: fileName,
          size: 0, // 分片上传时前端需要计算
          type: 'application/octet-stream',
          url: fileUrl
        },
        completed: true
      });
    }
    
    return NextResponse.json({
      success: true,
      progress: Math.round((uploadedChunks / totalChunks) * 100),
      completed: false
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json(
      { success: false, error: '分片上传失败' },
      { status: 500 }
    );
  }
}
