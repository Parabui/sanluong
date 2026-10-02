@echo off
echo Dang kiem tra may (chi doc, khong thay doi gi)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kiem-tra-may.ps1"
echo.
echo Xong. Quay lai Claude va bao "da chay xong".
pause
