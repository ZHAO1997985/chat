@echo off
chcp 65001 >nul
title 蒙面畅聊服务器
echo ========================================
echo   蒙面畅聊 - 匿名阶梯交友APP
echo ========================================
echo.
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
C:\Users\赵渊渊\AppData\Local\Programs\Python\Python312\python.exe chat.py
pause
