@echo off
REM 发布井盖年龄榜 H5 到 GitHub Pages（docs/ 目录）
REM 步骤：
REM   1) 在 HBuilderX 中：发行 → 网站-H5（SSR 发行也行，取 client 子目录）
REM      构建产物位于 unpackage\dist\build\web\client
REM   2) 双击本脚本（或在项目根目录运行 publish-h5.bat），会把产物复制到 docs\
REM      同时把审核后台 admin-web\ 复制到 docs\admin\（上线后为 https://h-icar.cn/admin/）
REM   3) git add docs 并提交推送，GitHub Pages（源：main 分支 /docs）即生效

set "SRC=unpackage\dist\build\web\client"
set "ADMIN_SRC=admin-web"
set "DST=docs"

if not exist "%SRC%" (
  echo [错误] 未找到构建产物：%SRC%
  echo 请先在 HBuilderX 中「发行 → 网站-H5」。
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"

REM 清理旧的 H5 资源（保留 admin、CNAME、.nojekyll），避免残留过期哈希文件
if exist "%DST%\assets" rmdir /S /Q "%DST%\assets"
if exist "%DST%\static" rmdir /S /Q "%DST%\static"

echo 正在复制 %SRC% → %DST% ...
xcopy /E /Y /I "%SRC%\*" "%DST%" >nul

echo 正在复制审核后台 %ADMIN_SRC% → %DST%\admin ...
if not exist "%DST%\admin" mkdir "%DST%\admin"
xcopy /E /Y /I "%ADMIN_SRC%\*" "%DST%\admin" >nul

echo h-icar.cn> "%DST%\CNAME"
echo. > "%DST%\.nojekyll"

echo.
echo [完成] 已发布到 %DST%\
echo   公开站点：https://h-icar.cn/
echo   审核后台：https://h-icar.cn/admin/
echo 接下来执行：
echo   git add docs
echo   git commit -m "deploy h5"
echo   git push
pause
