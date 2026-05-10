# Docker启动PostgreSQL的命令
# 安装Docker Desktop后，在命令行运行以下命令：

docker run --name xiaozhi-postgres \
  -e POSTGRES_DB=xiaozhi \
  -e POSTGRES_USER=xiaozhi \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# 检查容器状态
docker ps

# 如果需要停止容器
# docker stop xiaozhi-postgres

# 如果需要删除容器
# docker rm xiaozhi-postgres