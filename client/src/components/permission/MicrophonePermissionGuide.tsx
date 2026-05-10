/**
 * Microphone Permission Guide Component
 *
 * Provides browser-specific guidance when microphone permission is denied.
 */

import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from 'react';

export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';

interface BrowserGuide {
  name: string;
  steps: string[];
  icon: string;
}

const BROWSER_GUIDES: Record<BrowserType, BrowserGuide> = {
  chrome: {
    name: 'Google Chrome',
    icon: '🌐',
    steps: [
      '点击地址栏左侧的锁图标 🔒',
      '在下拉菜单中找到"麦克风"设置',
      '点击下拉菜单并选择"允许"',
      '刷新页面重试',
    ],
  },
  firefox: {
    name: 'Mozilla Firefox',
    icon: '🦊',
    steps: [
      '点击地址栏左侧的锁图标 🔒',
      '在弹出面板中点击"连接右侧的箭头"',
      '找到"麦克风"权限',
      '选择"允许"并刷新页面',
    ],
  },
  safari: {
    name: 'Safari',
    icon: '🧭',
    steps: [
      '点击 Safari 菜单 > "偏好设置"',
      '进入"网站"标签页',
      '在左侧选择"麦克风"',
      '找到当前网站并设置为"允许"',
    ],
  },
  edge: {
    name: 'Microsoft Edge',
    icon: '🔷',
    steps: [
      '点击地址栏左侧的锁图标或网站信息图标',
      '找到"麦克风"权限',
      '点击并选择"允许"',
      '刷新页面重试',
    ],
  },
  unknown: {
    name: '您的浏览器',
    icon: '🌐',
    steps: [
      '点击地址栏左侧的地址图标或锁图标',
      '在权限设置中找到"麦克风"',
      '将权限设置为"允许"',
      '刷新页面重试',
      '如仍有问题，请查看浏览器帮助文档',
    ],
  },
};

interface MicrophonePermissionGuideProps {
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export function MicrophonePermissionGuide({
  onRetry,
  onOpenSettings,
}: MicrophonePermissionGuideProps): React.ReactElement {
  const [browser, setBrowser] = useState<BrowserType>('unknown');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setBrowser(detectBrowser());
  }, []);

  const guide = BROWSER_GUIDES[browser];
  const canOpenSettings = canOpenBrowserSettings();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="microphone-permission-guide"
      style={{
        padding: '24px',
        borderRadius: '12px',
        backgroundColor: '#FFF3E0',
        border: '1px solid #FFE0B2',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: '48px',
            marginRight: '16px',
          }}
          aria-hidden="true"
        >
          {guide.icon}
        </span>
        <div>
          <h3
            style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: '#E65100',
            }}
          >
            麦克风权限被拒绝
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#BF360C',
            }}
          >
            检测到您正在使用 {guide.name}
          </p>
        </div>
      </div>

      <p
        style={{
          marginBottom: '16px',
          fontSize: '14px',
          color: '#5D4037',
          lineHeight: 1.6,
        }}
      >
        为了使用语音功能，请允许麦克风权限。您可以按照以下步骤操作，或者点击按钮打开浏览器设置。
      </p>

      {showDetails && (
        <ol
          style={{
            marginBottom: '20px',
            paddingLeft: '20px',
            fontSize: '14px',
            color: '#5D4037',
            lineHeight: 1.8,
          }}
        >
          {guide.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      )}

      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="outline"
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid #FFB74D',
            backgroundColor: '#FFF8E1',
            color: '#E65100',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
          aria-expanded={showDetails}
        >
          {showDetails ? '隐藏步骤' : '查看步骤'}
        </Button>

        {canOpenSettings && (
          <Button variant="outline" onClick={onOpenSettings}>打开浏览器设置</Button>
        )}

        <Button variant="outline" onClick={onRetry}>重试</Button>
      </div>

      <p
        style={{
          marginTop: '16px',
          marginBottom: 0,
          fontSize: '12px',
          color: '#8D6E63',
          fontStyle: 'italic',
        }}
      >
        提示：某些浏览器可能需要完全关闭并重新打开才能应用权限更改。
      </p>
    </div>
  );
}

function detectBrowser(): BrowserType {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const ua = navigator.userAgent;

  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    return 'chrome';
  }
  if (ua.includes('Firefox')) {
    return 'firefox';
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return 'safari';
  }
  if (ua.includes('Edg')) {
    return 'edge';
  }

  return 'unknown';
}

function canOpenBrowserSettings(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return (
    navigator.mediaDevices !== undefined &&
    'getUserMedia' in navigator.mediaDevices
  );
}

export default MicrophonePermissionGuide;
