# 小智 (Avatar) AI助手系统 - 完整部署指南

**版本**: 2.0.0  
**更新日期**: 2026-03-13  
**适用环境**: 生产环境

---

## 一、部署概述

本文档提供小智 (Avatar) AI助手系统的完整部署指南，包含环境准备、Docker部署、服务配置、安全加固、监控运维等全方位指导。

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      负载均衡层 (Nginx)                       │
│                      端口: 80 / 443                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     应用服务层 (Node.js)                     │
│                     容器名: sheng-yu-app                    │
│                     端口: 5000                               │
└─────────────────────────────────────────────────────────────┘
          │                                       │
          ▼                                       ▼
┌─────────────────────┐             ┌─────────────────────────┐
│   PostgreSQL 15     │             │      Redis 7           │
│   端口: 5432        │             │      端口: 6379         │
│   容器: database    │             │      容器: redis        │
└─────────────────────┘             └─────────────────────────┘
```

### 1.2 部署模式

| 部署模式 | 说明 | 适用场景 |
|----------|------|----------|
| Docker Compose | 一键部署，推荐 | 单服务器部署 |
| Docker Swarm | 集群部署 | 多节点集群 |
| 传统部署 | 直接运行 | 开发/测试环境 |

---

## 二、环境要求

### 2.1 硬件要求

| 资源 | 最低配置 | 推荐配置 | 生产高可用 |
|------|----------|----------|------------|
| CPU | 2核心 | 4核心+ | 8核心+ |
| 内存 | 4GB | 8GB+ | 16GB+ |
| 系统盘 | 20GB | 50GB | 100GB |
| 数据盘 | 50GB | 100GB | 500GB |
| 网络 | 5Mbps | 10Mbps+ | 100Mbps |

### 2.2 软件要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| 操作系统 | Ubuntu 20.04+ / CentOS 8+ / Debian 11+ | 推荐 Ubuntu 22.04 LTS |
| Docker | 24.0+ | 容器运行时 |
| Docker Compose | 2.20+ | 容器编排 |
| Git | 2.30+ | 代码管理 |
| OpenSSL | 1.1.1+ | SSL证书支持 |

### 2.3 端口规划

| 服务 | 端口 | 协议 | 说明 |
|------|------|------|------|
| Nginx HTTP | 80 | TCP | HTTP入口 |
| Nginx HTTPS | 443 | TCP | HTTPS入口 |
| PostgreSQL | 5432 | TCP | 数据库(仅内网) |
| Redis | 6379 | TCP | 缓存(仅内网) |
| 应用服务 | 5000 | TCP | 后端服务(仅内网) |

---

## 三、部署前准备

### 3.1 创建部署目录

```bash
# 创建部署目录
mkdir -p /opt/sheng-yu-zhu-shou
cd /opt/sheng-yu-zhu-shou

# 创建必要目录
mkdir -p {nginx/ssl,postgres,redis,logs,backup}
```

### 3.2 获取部署包

```bash
# 从Release页面下载最新部署包
# 或使用项目根目录已有的构建产物
ls -la /path/to/Sheng-Yu-Zhu-Shou/dist/
```

### 3.3 配置环境变量

```bash
# 复制生产环境变量模板
cp .env.example .env.production

# 编辑生产环境变量
nano .env.production
```

**重要环境变量配置**:

```bash
# ========== 应用配置 ==========
NODE_ENV=production
PORT=5000

# ========== 数据库配置 ==========
POSTGRES_USER=sheng_yu_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=sheng_yu_zhu_shou
DB_HOST=database
DB_PORT=5432

# ========== Redis配置 ==========
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# ========== 会话安全 ==========
SESSION_SECRET=your_very_long_random_session_secret
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict

# ========== CORS配置 ==========
CORS_ORIGIN=https://your-domain.com

# ========== 安全配置 ==========
HELMET_ENABLED=true

# ========== AI服务 (可选) ==========
DASHSCOPE_API_KEY=your_dashscope_key
DEEPSEEK_API_KEY=your_deepseek_key
```

---

## 四、Docker部署

### 4.1 使用Docker Compose部署

#### 步骤1: 拉取最新代码或使用构建产物

```bash
# 方式A: 使用构建产物部署
cp -r dist/ /opt/sheng-yu-zhu-shou/
cp docker-compose.prod.yml /opt/sheng-yu-zhu-shou/
cp .env.production /opt/sheng-yu-zhu-shou/.env

# 方式B: 直接构建部署
git clone <repo-url> /opt/sheng-yu-zhu-shou
cd /opt/sheng-yu-zhu-shou
npm run build
```

#### 步骤2: 启动服务

```bash
cd /opt/sheng-yu-zhu-shou

# 拉取镜像
docker-compose -f docker-compose.prod.yml pull

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps
```

#### 步骤3: 验证部署

```bash
# 检查健康状态
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/system/health

# 检查容器日志
docker-compose -f docker-compose.prod.yml logs -f app
```

### 4.2 服务管理命令

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml start

# 停止服务
docker-compose -f docker-compose.prod.yml stop

# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看实时状态
docker stats

# 进入容器调试
docker exec -it sheng-yu-app /bin/sh
```

---

## 五、Nginx配置

### 5.1 SSL证书配置

```bash
# 使用Let's Encrypt获取免费SSL证书 (推荐)
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com -d www.your-domain.com

# 或使用自签名证书 (测试环境)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/server.key \
  -out nginx/ssl/server.crt
```

### 5.2 Nginx配置文件

创建 `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 上游服务器
    upstream backend {
        server app:5000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 重定向到HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

        client_max_body_size 50M;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 86400;
        }
    }
}
```

---

## 六、数据库初始化

### 6.1 初始化数据库

```bash
# 等待数据库就绪
docker-compose -f docker-compose.prod.yml exec database pg_isready

# 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec app npm run db:push
```

### 6.2 数据库备份

```bash
# 创建备份脚本
cat > /opt/sheng-yu-zhu-shou/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/sheng-yu-zhu-shou/backup"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker-compose -f docker-compose.prod.yml exec -T database \
  pg_dump -U sheng_yu_user sheng_yu_zhu_shou > \
  $BACKUP_DIR/backup_$DATE.sql

# 删除30天前的备份
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
EOF

chmod +x /opt/sheng-yu-zhu-shou/backup.sh

# 添加定时任务
crontab -e
# 0 2 * * * /opt/sheng-yu-zhu-shou/backup.sh
```

---

## 七、安全加固

### 7.1 防火墙配置

```bash
# Ubuntu (UFW)
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable

# 或使用 iptables
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 7.2 Docker安全配置

```bash
# 限制容器资源
docker update --memory=2g --cpus=2 sheng-yu-app

# 启用Docker内容信任
export DOCKER_CONTENT_TRUST=1

# 定期更新镜像
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 7.3 定期安全更新

```bash
# 创建更新脚本
cat > /opt/sheng-yu-zhu-shou/update.sh << 'EOF'
#!/bin/bash
cd /opt/sheng-yu-zhu-shou

# 拉取最新代码
git pull

# 重新构建
npm run build

# 重启服务
docker-compose -f docker-compose.prod.yml up -d --build
EOF

chmod +x /opt/sheng-yu-zhu-shou/update.sh
```

---

## 八、监控与运维

### 8.1 健康检查

```bash
# 应用健康检查
curl -f http://localhost:5000/health

# 系统状态
curl http://localhost:5000/api/v1/system/overview

# 数据库状态
curl http://localhost:5000/api/v1/system/database/performance
```

### 8.2 日志管理

```bash
# 应用日志
docker-compose -f docker-compose.prod.yml logs app --tail=100

# 聚合日志
docker-compose -f docker-compose.prod.yml logs --tail=100 --follow
```

### 8.3 性能监控指标

通过API获取系统指标:

```bash
# 获取系统指标
curl http://localhost:5000/api/v1/monitoring/metrics

# 获取告警列表
curl http://localhost:5000/api/v1/monitoring/alerts
```

**关键监控指标**:

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| CPU使用率 | < 70% | > 80% |
| 内存使用率 | < 75% | > 85% |
| 磁盘使用率 | < 70% | > 90% |
| API响应时间 | < 500ms | > 1000ms |
| 数据库连接数 | < 80% | > 90% |

---

## 九、故障排查

### 9.1 常见问题

#### 服务启动失败

```bash
# 检查容器状态
docker ps -a

# 查看错误日志
docker-compose -f docker-compose.prod.yml logs app

# 检查端口占用
netstat -tlnp | grep 5000
```

#### 数据库连接失败

```bash
# 检查数据库容器
docker-compose -f docker-compose.prod.yml logs database

# 测试数据库连接
docker-compose -f docker-compose.prod.yml exec app nc -zv database 5432
```

#### 前端资源加载失败

```bash
# 检查Nginx日志
docker-compose -f docker-compose.prod.yml logs nginx

# 检查静态文件
ls -la /opt/sheng-yu-zhu-shou/dist/public/
```

### 9.2 紧急恢复

```bash
# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 清理数据卷 (注意: 会删除所有数据)
docker-compose -f docker-compose.prod.yml down -v

# 重新部署
docker-compose -f docker-compose.prod.yml up -d
```

---

## 十、部署清单

### 10.1 部署前检查

- [ ] 服务器硬件满足要求
- [ ] 操作系统已安装并更新
- [ ] Docker和Docker Compose已安装
- [ ] 域名已解析到服务器
- [ ] SSL证书已准备 (生产环境)
- [ ] 环境变量已配置
- [ ] 防火墙已配置
- [ ] 备份策略已制定

### 10.2 部署后验证

- [ ] 所有Docker容器运行正常
- [ ] 健康检查端点返回正常
- [ ] 前端页面可访问
- [ ] API接口可正常调用
- [ ] 数据库连接正常
- [ ] Redis缓存正常
- [ ] 日志正常输出
- [ ] 监控指标正常

---

## 附录

### 附录A: Docker命令快速参考

```bash
# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f

# 重启单个服务
docker-compose restart app

# 进入容器
docker exec -it sheng-yu-app /bin/sh

# 重新构建
docker-compose build --no-cache
```

### 附录B: 环境变量完整列表

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| NODE_ENV | 是 | production | 运行环境 |
| PORT | 是 | 5000 | 服务端口 |
| DB_HOST | 是 | database | 数据库主机 |
| DB_PORT | 是 | 5432 | 数据库端口 |
| DB_USER | 是 | - | 数据库用户 |
| DB_PASSWORD | 是 | - | 数据库密码 |
| DB_NAME | 是 | - | 数据库名称 |
| REDIS_HOST | 是 | redis | Redis主机 |
| REDIS_PORT | 是 | 6379 | Redis端口 |
| REDIS_PASSWORD | 是 | - | Redis密码 |
| SESSION_SECRET | 是 | - | 会话密钥 |
| CORS_ORIGIN | 是 | - | 允许的源 |

---

**技术支持**: 请参考项目文档或提交Issue  
**版本**: 2.0.0  
**最后更新**: 2026-03-13
