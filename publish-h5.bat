@echo off
REM 发布井盖年龄榜 H5 到 GitHub Pages（docs/ 目录）
REM 步骤：
REM   1) 在 HBuilderX 中：发行 → 网站-H5（或 App/H5 等），构建产物位于 unpackage\dist\build\h5
REM   2) 双击本脚本（或在项目根目录运行 publish-h5.bat），会把产物复制到 docs\
REM   3) git add docs 并提交推送，GitHub Pages（源：main 分支 /docs）即生效

set "SRC=unpackage\dist\build\h5"
set "DST=docs"

if not exist "%SRC%" (
  echo [错误] 未找到构建产物：%SRC%
  echo 请先在 HBuilderX 中「发行 → 网站-H5」。
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"
echo 正在复制 %SRC% → %DST% ...
xcopy /E /Y /I "%SRC%\*" "%DST%" >nul
echo. > "%DST%\.nojekyll"
echo.
echo [完成] 已发布到 %DST%\
echo 接下来执行：
echo   git add docs
echo   git commit -m "deploy h5"
echo   git push
pause
