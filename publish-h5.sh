#!/usr/bin/env bash
# 发布井盖年龄榜 H5 到 GitHub Pages（docs/ 目录）
# 1) HBuilderX：发行 → 网站-H5，产物位于 unpackage/dist/build/h5
# 2) 运行 bash publish-h5.sh，复制产物到 docs/
# 3) git add docs && git commit && git push，GitHub Pages（源：main /docs）即生效
set -e

SRC="unpackage/dist/build/h5"
DST="docs"

if [ ! -d "$SRC" ]; then
  echo "[错误] 未找到构建产物：$SRC"
  echo "请先在 HBuilderX 中「发行 → 网站-H5」。"
  exit 1
fi

mkdir -p "$DST"
rm -rf "$DST"/*
cp -r "$SRC"/. "$DST"/
touch "$DST/.nojekyll"
echo "[完成] 已发布到 $DST/"
echo "接下来执行：git add docs && git commit -m 'deploy h5' && git push"
