#!/bin/bash
# 自定义构建脚本，绕过 npm ci 问题

echo "开始自定义构建流程..."

# 强制使用 npm install 而不是 npm ci
echo "使用 npm install 安装依赖..."
npm install --no-package-lock --no-audit --no-fund

# 运行构建
echo "运行构建命令..."
npm run build

echo "构建完成！"
