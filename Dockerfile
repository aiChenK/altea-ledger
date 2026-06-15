# Stage 1: 构建前端静态资源
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: 启动生产环境 Express 服务
FROM node:20-alpine

WORKDIR /app

# 设置默认时区为亚洲/上海（龙之谷日常与周常重置依赖系统时间）
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

COPY package*.json ./
RUN npm ci --only=production

# 拷贝前端构建产物与后端运行所需文件
COPY --from=builder /app/dist ./dist
COPY server.js reset-check.js ./
COPY data/config.json ./data/config.json

EXPOSE 3001

ENV PORT=3001

CMD ["node", "server.js"]
