import { NextRequest, NextResponse } from 'next/server';
import { existsSync, createReadStream, statSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// 支持预览的文件类型
const PREVIEWABLE_TYPES: Record<string, string> = {
  // 图片
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  // PDF
  '.pdf': 'application/pdf',
  // 视频
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string[] }> }
) {
  try {
    const { fileName: fileNameParts } = await params;
    const fileName = fileNameParts?.join('/') || '';
    
    if (!fileName) {
      return NextResponse.json(
        { error: '文件名不能为空' },
        { status: 400 }
      );
    }
    
    // 安全检查：防止路径遍历
    const decodedFileName = decodeURIComponent(fileName);
    if (decodedFileName.includes('..') || decodedFileName.includes('/')) {
      return NextResponse.json(
        { error: '无效的文件路径' },
        { status: 400 }
      );
    }
    
    const filePath = path.join(UPLOAD_DIR, decodedFileName);
    
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      );
    }
    
    const stat = statSync(filePath);
    const ext = path.extname(decodedFileName).toLowerCase();
    const contentType = PREVIEWABLE_TYPES[ext] || 'application/octet-stream';
    
    // 检查是否是支持预览的类型
    const isPreviewable = ext in PREVIEWABLE_TYPES;
    
    // 如果是预览请求且支持预览
    const searchParams = request.nextUrl.searchParams;
    const preview = searchParams.get('preview');
    
    if (isPreviewable && preview === 'true') {
      const fileStream = createReadStream(filePath);
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }
    
    // 否则返回文件下载
    const fileStream = createReadStream(filePath);
    const chunks: Uint8Array[] = [];
    
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(decodedFileName)}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('File access error:', error);
    return NextResponse.json(
      { error: '访问文件失败' },
      { status: 500 }
    );
  }
}

// 删除文件
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string[] }> }
) {
  try {
    const { fileName: fileNameParts } = await params;
    const fileName = fileNameParts?.join('/') || '';
    
    if (!fileName) {
      return NextResponse.json(
        { error: '文件名不能为空' },
        { status: 400 }
      );
    }
    
    const decodedFileName = decodeURIComponent(fileName);
    if (decodedFileName.includes('..') || decodedFileName.includes('/')) {
      return NextResponse.json(
        { error: '无效的文件路径' },
        { status: 400 }
      );
    }
    
    const filePath = path.join(UPLOAD_DIR, decodedFileName);
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      );
    }
    
    await import('fs/promises').then(fs => fs.unlink(filePath));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('File delete error:', error);
    return NextResponse.json(
      { error: '删除文件失败' },
      { status: 500 }
    );
  }
}
