#!/usr/bin/env bash
# 发布井盖年龄榜 H5 到 GitHub Pages（docs/ 目录）
# 1) HBuilderX：发行 → 网站-H5（SSR 发行也行，取 client 子目录），产物位于 unpackage/dist/build/web/client
# 2) 运行 bash publish-h5.sh，复制产物到 docs/，同时把审核后台 admin-web/ 复制到 docs/admin/
# 3) git add docs && git commit && git push，GitHub Pages（源：main /docs）即生效
set -e

SRC="unpackage/dist/build/web/client"
ADMIN_SRC="admin-web"
DST="docs"

if [ ! -d "$SRC" ]; then
  echo "[错误] 未找到构建产物：$SRC"
  echo "请先在 HBuilderX 中「发行 → 网站-H5」。"
  exit 1
fi

mkdir -p "$DST"

# 清理旧的 H5 资源（保留 admin、CNAME、.nojekyll），避免残留过期哈希文件
find "$DST" -mindepth 1 -maxdepth 1 ! -name 'admin' ! -name 'CNAME' ! -name '.nojekyll' -exec rm -rf {} + 2>/dev/null || true

echo "正在复制 $SRC → $DST ..."
cp -r "$SRC"/. "$DST"/

echo "正在复制审核后台 $ADMIN_SRC → $DST/admin ..."
mkdir -p "$DST/admin"
rm -rf "$DST/admin"/*
cp -r "$ADMIN_SRC"/. "$DST/admin"/

printf 'h-icar.cn' > "$DST/CNAME"
touch "$DST/.nojekyll"

echo "[完成] 已发布到 $DST/"
echo "  公开站点：https://h-icar.cn/"
echo "  审核后台：https://h-icar.cn/admin/"
echo "接下来执行：git add docs && git commit -m 'deploy h5' && git push"
