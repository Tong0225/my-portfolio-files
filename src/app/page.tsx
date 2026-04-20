'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Upload, Trash2, Edit, Plus, Settings, Lock, FolderOpen,
  Image, Video, FileText, File, Link as LinkIcon, Play,
  Eye, Clock, X, Save, Check, ExternalLink, Github
} from 'lucide-react';

// 类型定义
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
}

// API
const api = {
  async getWorks(): Promise<Work[]> {
    const res = await fetch('/api/works');
    const data = await res.json();
    return data.works || [];
  },
  async addWork(work: Partial<Work>): Promise<Work> {
    const res = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(work),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.work;
  },
  async deleteWork(id: string): Promise<void> {
    const res = await fetch(`/api/works?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },
  async getConfig(): Promise<Config> {
    const res = await fetch('/api/config');
    const data = await res.json();
    return data.config;
  },
  async saveConfig(config: Partial<Config>): Promise<void> {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },
  async verifyPassword(password: string): Promise<boolean> {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return data.valid;
  },
};

// 工具函数
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

const getFileIcon = (type: string) => {
  switch (type) {
    case 'image': return <Image className="w-12 h-12" />;
    case 'image_link': return <Image className="w-12 h-12" />;
    case 'video_local': return <Video className="w-12 h-12" />;
    case 'video_link': return <Play className="w-12 h-12" />;
    case 'pdf': return <FileText className="w-12 h-12" />;
    case 'document': return <File className="w-12 h-12" />;
    default: return <File className="w-12 h-12" />;
  }
};

const detectVideoPlatform = (url: string): string => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('bilibili.com') || lower.includes('b23.tv')) return 'bilibili';
  if (lower.includes('douyin.com')) return 'douyin';
  if (lower.includes('ixigua.com')) return 'xigua';
  if (lower.includes('v.qq.com')) return 'tencent';
  if (lower.includes('youku.com')) return 'youku';
  if (lower.includes('iqiyi.com')) return 'iqiyi';
  if (lower.includes('github.com') || lower.includes('raw.githubusercontent.com')) return 'github';
  return '';
};

const getPlatformName = (platform: string): string => {
  const names: Record<string, string> = {
    youtube: 'YouTube',
    bilibili: 'B站',
    douyin: '抖音',
    xigua: '西瓜',
    tencent: '腾讯',
    youku: '优酷',
    iqiyi: '爱奇艺',
    github: 'GitHub'
  };
  return names[platform] || '视频';
};

const getPlatformColor = (platform: string): string => {
  const colors: Record<string, string> = {
    youtube: '#FF0000',
    bilibili: '#FF5499',
    douyin: '#000000',
    xigua: '#4999FF',
    tencent: '#FF6600',
    youku: '#00BFFF',
    iqiyi: '#00BE06',
    github: '#24292f'
  };
  return colors[platform] || '#6366f1';
};

export default function PortfolioPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentMain, setCurrentMain] = useState('all');
  const [currentSub, setCurrentSub] = useState('all');
  const [previewWork, setPreviewWork] = useState<Work | null>(null);

  // 模态框
  const [showLogin, setShowLogin] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 表单
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [workForm, setWorkForm] = useState({
    title: '',
    description: '',
    mainCategory: '',
    subCategory: '',
    type: '',
    fileUrl: '',
    fileName: '',
    fileSize: 0,
  });
  const [settingsForm, setSettingsForm] = useState<Partial<Config>>({});
  const [mainCategories, setMainCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [selectedMainForSub, setSelectedMainForSub] = useState('');

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [worksData, configData] = await Promise.all([
        api.getWorks(),
        api.getConfig()
      ]);
      setWorks(worksData);
      setConfig(configData);
      setMainCategories(Object.keys(configData.categories));
    } catch (error) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setPasswordError('请输入密码');
      return;
    }
    const valid = await api.verifyPassword(password);
    if (valid) {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      toast.success('登录成功');
    } else {
      setPasswordError('密码错误');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    toast.success('已退出登录');
  };

  const openAddWork = () => {
    setEditingWork(null);
    setWorkForm({
      title: '',
      description: '',
      mainCategory: '',
      subCategory: '',
      type: '',
      fileUrl: '',
      fileName: '',
      fileSize: 0,
    });
    setShowWork(true);
  };

  const openEditWork = (work: Work) => {
    setEditingWork(work);
    setWorkForm({
      title: work.title,
      description: work.description,
      mainCategory: work.mainCategory,
      subCategory: work.subCategory,
      type: work.type,
      fileUrl: work.fileUrl,
      fileName: work.fileName,
      fileSize: work.fileSize,
    });
    setShowWork(true);
  };

  const handleDeleteWork = async (work: Work) => {
    if (!confirm(`确定要删除"${work.title}"吗？`)) return;
    try {
      await api.deleteWork(work.id);
      setWorks(prev => prev.filter(w => w.id !== work.id));
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleSaveWork = async () => {
    if (!workForm.title) {
      toast.error('请输入标题');
      return;
    }
    if (!workForm.mainCategory) {
      toast.error('请选择一级分类');
      return;
    }
    if (!workForm.type) {
      toast.error('请选择作品类型');
      return;
    }
    if (!workForm.fileUrl) {
      toast.error('请输入文件链接');
      return;
    }

    const videoPlatform = workForm.type === 'video_link'
      ? detectVideoPlatform(workForm.fileUrl)
      : undefined;

    try {
      const work = {
        id: editingWork?.id,
        title: workForm.title,
        description: workForm.description,
        mainCategory: workForm.mainCategory,
        subCategory: workForm.subCategory,
        type: workForm.type,
        fileUrl: workForm.fileUrl,
        fileName: workForm.fileName || workForm.title,
        fileSize: workForm.fileSize,
        videoPlatform,
        createdAt: editingWork?.createdAt,
      };

      const saved = await api.addWork(work);
      if (editingWork) {
        setWorks(prev => prev.map(w => w.id === saved.id ? saved : w));
      } else {
        setWorks(prev => [saved, ...prev]);
      }
      setShowWork(false);
      toast.success(editingWork ? '更新成功' : '添加成功');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.saveConfig(settingsForm);
      setConfig(prev => prev ? { ...prev, ...settingsForm } : null);
      setShowSettings(false);
      toast.success('设置已保存');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleSaveCategories = async () => {
    if (!config) return;
    const newCategories: Record<string, string[]> = {};
    mainCategories.forEach(main => {
      if (main.trim()) {
        newCategories[main.trim()] = subCategories;
      }
    });
    try {
      await api.saveConfig({ categories: newCategories });
      setConfig(prev => prev ? { ...prev, categories: newCategories } : null);
      setShowCategory(false);
      toast.success('分类已保存');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const openSettings = () => {
    if (config) {
      setSettingsForm({ ...config });
    }
    setShowSettings(true);
  };

  // 预览
  const getPreviewContent = (work: Work) => {
    switch (work.type) {
      case 'image':
      case 'image_link':
        return (
          <img
            src={work.fileUrl}
            alt={work.title}
            className="max-w-full max-h-[80vh] object-contain"
          />
        );

      case 'video_link': {
        const platform = work.videoPlatform;
        const url = work.fileUrl;

        // YouTube
        if (platform === 'youtube') {
          const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          const videoId = match?.[1];
          if (videoId) {
            return (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
                className="w-full h-[80vh] border-0"
                allowFullScreen
              />
            );
          }
        }

        // B站
        if (platform === 'bilibili') {
          const match = url.match(/BV[a-zA-Z0-9]+/);
          const bvId = match?.[0];
          if (bvId) {
            return (
              <iframe
                src={`//player.bilibili.com/player.html?bvid=${bvId}&page=1&high_quality=1`}
                className="w-full h-[80vh] border-0"
                allowFullScreen
              />
            );
          }
        }

        // GitHub/本地视频
        if (url.match(/\.(mp4|webm|ogg)$/i) || platform === 'github') {
          return (
            <video controls autoPlay className="max-w-full max-h-[80vh]">
              <source src={url} />
              您的浏览器不支持视频播放
            </video>
          );
        }

        return (
          <div className="text-center p-12 bg-white rounded-xl">
            <Play className="w-20 h-20 mx-auto mb-4 text-gray-400" />
            <p className="mb-4">来自 {getPlatformName(platform || '')}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              <ExternalLink className="w-4 h-4" />
              在 {getPlatformName(platform || '')} 播放
            </a>
          </div>
        );
      }

      case 'pdf':
        return (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(work.fileUrl)}&embedded=true`}
            className="w-full h-[80vh] border-0 bg-white"
          />
        );

      case 'document': {
        const ext = work.fileName.split('.').pop()?.toLowerCase();
        const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext || '');
        if (isOffice) {
          return (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(work.fileUrl)}`}
              className="w-full h-[80vh] border-0"
            />
          );
        }
        return (
          <div className="text-center p-12 bg-white rounded-xl">
            <File className="w-20 h-20 mx-auto mb-4 text-blue-500" />
            <p className="mb-4">{work.fileName}</p>
            <a
              href={work.fileUrl}
              download={work.fileName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              <ExternalLink className="w-4 h-4" />
              下载查看
            </a>
          </div>
        );
      }

      case 'link':
      default:
        return (
          <div className="text-center p-12 bg-white rounded-xl max-w-md mx-auto">
            <LinkIcon className="w-16 h-16 mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-semibold mb-2">{work.title}</h3>
            <p className="text-gray-500 mb-4 text-sm break-all">{work.fileUrl}</p>
            <a
              href={work.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              <ExternalLink className="w-4 h-4" />
              访问链接
            </a>
          </div>
        );
    }
  };

  const filteredWorks = works.filter(work => {
    if (currentMain !== 'all' && work.mainCategory !== currentMain) return false;
    if (currentSub !== 'all' && work.subCategory !== currentSub) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                Z
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  {config?.siteTitle || '个人作品展示'}
                </h1>
                <p className="text-gray-500">{config?.siteDescription || '记录每一个创意瞬间'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowCategory(true)}>
                <FolderOpen className="w-4 h-4 mr-2" />
                管理分类
              </Button>
              <Button variant="outline" onClick={openSettings}>
                <Settings className="w-4 h-4 mr-2" />
                网站设置
              </Button>
              {isAdmin ? (
                <Button variant="destructive" onClick={handleLogout}>
                  <Lock className="w-4 h-4 mr-2" />
                  退出
                </Button>
              ) : (
                <Button onClick={() => setShowLogin(true)}>
                  <Lock className="w-4 h-4 mr-2" />
                  登录
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* GitHub使用提示 */}
        <div className="mb-8 p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl text-white">
          <div className="flex items-start gap-3">
            <Github className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">使用GitHub存储文件</h3>
              <p className="text-sm text-gray-300 mb-2">
                将视频、图片、文档上传到GitHub仓库后，复制文件链接粘贴到网站即可展示。
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-gray-700 rounded">1. 创建GitHub仓库</span>
                <span className="px-2 py-1 bg-gray-700 rounded">2. 上传文件到仓库</span>
                <span className="px-2 py-1 bg-gray-700 rounded">3. 点击文件 → Raw → 复制链接</span>
                <span className="px-2 py-1 bg-gray-700 rounded">4. 粘贴到网站添加作品</span>
              </div>
            </div>
          </div>
        </div>

        {/* 分类导航 */}
        <nav className="mb-8">
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <button
              onClick={() => { setCurrentMain('all'); setCurrentSub('all'); }}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                currentMain === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
              }`}
            >
              全部作品
            </button>
            {mainCategories.map(cat => (
              <button
                key={cat}
                onClick={() => { setCurrentMain(cat); setCurrentSub('all'); }}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  currentMain === cat
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {currentMain !== 'all' && config?.categories[currentMain] && (
            <div className="flex flex-wrap justify-center gap-2 p-4 bg-white rounded-xl shadow-sm">
              <button
                onClick={() => setCurrentSub('all')}
                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                  currentSub === 'all'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'
                }`}
              >
                全部
              </button>
              {config.categories[currentMain].map(sub => (
                <button
                  key={sub}
                  onClick={() => setCurrentSub(sub)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                    currentSub === sub
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* 作品网格 */}
        {filteredWorks.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen className="w-20 h-20 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无作品</h3>
            <p className="text-gray-400 mb-4">点击下方按钮添加您的第一个作品</p>
            {isAdmin && (
              <Button onClick={openAddWork}>
                <Plus className="w-4 h-4 mr-2" />
                添加作品
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorks.map(work => (
              <div
                key={work.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => setPreviewWork(work)}
              >
                <div className="relative h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center overflow-hidden">
                  {(work.type === 'image' || work.type === 'image_link') && work.fileUrl ? (
                    <img
                      src={work.fileUrl}
                      alt={work.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-indigo-400 group-hover:scale-110 transition-transform">
                      {getFileIcon(work.type)}
                    </div>
                  )}

                  {(work.type === 'video_link') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-indigo-500 ml-1" />
                      </div>
                    </div>
                  )}

                  {work.type === 'video_link' && work.videoPlatform && (
                    <span
                      className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: getPlatformColor(work.videoPlatform) }}
                    >
                      {getPlatformName(work.videoPlatform)}
                    </span>
                  )}
                  {work.type === 'pdf' && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium bg-red-500 text-white">PDF</span>
                  )}
                  {work.type === 'document' && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium bg-blue-500 text-white">文档</span>
                  )}
                  {work.type === 'link' && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium bg-indigo-500 text-white">链接</span>
                  )}

                  <span className="absolute bottom-3 left-3 px-3 py-1 bg-white/90 rounded-full text-xs font-medium text-indigo-600">
                    {work.subCategory || work.mainCategory}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 truncate">{work.title}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {work.description || '暂无描述'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(work.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      点击预览
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <div
                    className="flex items-center justify-end gap-2 px-4 pb-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="outline" onClick={() => openEditWork(work)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteWork(work)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {isAdmin && (
              <div
                className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center h-64 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                onClick={openAddWork}
              >
                <Plus className="w-12 h-12 text-gray-300 mb-2" />
                <span className="text-gray-400">添加作品</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Login Modal */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              管理员登录
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>输入密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理员密码"
              className="mt-2 text-center text-lg tracking-widest"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {passwordError && (
              <p className="text-red-500 text-sm mt-2 text-center">{passwordError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleLogin}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Work Modal */}
      <Dialog open={showWork} onOpenChange={setShowWork}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWork ? '编辑作品' : '添加作品'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>作品标题 *</Label>
              <Input
                value={workForm.title}
                onChange={(e) => setWorkForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="请输入作品标题"
                className="mt-1"
              />
            </div>

            <div>
              <Label>作品描述</Label>
              <Textarea
                value={workForm.description}
                onChange={(e) => setWorkForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入作品描述（可选）"
                className="mt-1"
              />
            </div>

            <div>
              <Label>一级分类 *</Label>
              <Select
                value={workForm.mainCategory}
                onValueChange={(v) => setWorkForm(prev => ({ ...prev, mainCategory: v, subCategory: '' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="请选择一级分类" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>二级分类</Label>
              <Select
                value={workForm.subCategory}
                onValueChange={(v) => setWorkForm(prev => ({ ...prev, subCategory: v }))}
                disabled={!workForm.mainCategory}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="请选择二级分类" />
                </SelectTrigger>
                <SelectContent>
                  {(config?.categories[workForm.mainCategory] || []).map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>作品类型 *</Label>
              <Select
                value={workForm.type}
                onValueChange={(v) => setWorkForm(prev => ({ ...prev, type: v, fileUrl: '' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="请选择作品类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">图片</SelectItem>
                  <SelectItem value="image_link">图片链接</SelectItem>
                  <SelectItem value="video_link">视频链接</SelectItem>
                  <SelectItem value="pdf">PDF文档</SelectItem>
                  <SelectItem value="document">Word/PPT文档</SelectItem>
                  <SelectItem value="link">网页链接</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>文件链接 *</Label>
              <Input
                value={workForm.fileUrl}
                onChange={(e) => setWorkForm(prev => ({ ...prev, fileUrl: e.target.value }))}
                placeholder={
                  workForm.type === 'image' || workForm.type === 'image_link'
                    ? '粘贴图片链接（GitHub/图床等）'
                    : workForm.type === 'video_link'
                    ? '粘贴视频链接（YouTube/B站/GitHub等）'
                    : '粘贴文件链接'
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 将文件上传到GitHub后，点击Raw按钮复制链接
              </p>
              {workForm.type === 'image_link' && workForm.fileUrl && (
                <div className="mt-2">
                  <img
                    src={workForm.fileUrl}
                    alt="预览"
                    className="max-h-32 rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSaveWork}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewWork} onOpenChange={() => setPreviewWork(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">{previewWork?.title}</h2>
            <DialogClose asChild>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>
          <div className="p-4 overflow-auto bg-gray-100">
            {previewWork && getPreviewContent(previewWork)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              网站设置
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>网站标题</Label>
              <Input
                value={settingsForm.siteTitle || ''}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, siteTitle: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>网站描述</Label>
              <Input
                value={settingsForm.siteDescription || ''}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, siteDescription: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>管理员密码</Label>
              <Input
                type="password"
                value={settingsForm.adminPassword || ''}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder="留空则不修改"
                className="mt-1"
              />
            </div>

            <div className="space-y-3">
              <Label>密码保护设置</Label>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">登录需要密码</p>
                  <p className="text-sm text-gray-500">进入管理模式时验证</p>
                </div>
                <Switch
                  checked={settingsForm.requirePasswordLogin ?? true}
                  onCheckedChange={(v) => setSettingsForm(prev => ({ ...prev, requirePasswordLogin: v }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">删除需要密码</p>
                  <p className="text-sm text-gray-500">删除作品时验证</p>
                </div>
                <Switch
                  checked={settingsForm.requirePasswordDelete ?? true}
                  onCheckedChange={(v) => setSettingsForm(prev => ({ ...prev, requirePasswordDelete: v }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSaveSettings}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={showCategory} onOpenChange={setShowCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              管理分类
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>一级分类</Label>
              <div className="space-y-2 mt-2">
                {mainCategories.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={cat}
                      onChange={(e) => {
                        const newCats = [...mainCategories];
                        newCats[i] = e.target.value;
                        setMainCategories(newCats);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500"
                      onClick={() => setMainCategories(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setMainCategories(prev => [...prev, '新分类'])}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加一级分类
                </Button>
              </div>
            </div>

            <div>
              <Label>二级分类</Label>
              <Select
                value={selectedMainForSub}
                onValueChange={(v) => {
                  setSelectedMainForSub(v);
                  setSubCategories(config?.categories[v] || []);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="选择一级分类" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMainForSub && (
                <div className="space-y-2 mt-2">
                  {subCategories.map((sub, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={sub}
                        onChange={(e) => {
                          const newSubs = [...subCategories];
                          newSubs[i] = e.target.value;
                          setSubCategories(newSubs);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500"
                        onClick={() => setSubCategories(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSubCategories(prev => [...prev, '新分类'])}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加二级分类
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSaveCategories}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
