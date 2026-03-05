@echo off
cd /d "D:\IMPRESSAO\SOFTWARES\PlasPrint IA Web"

git pull origin main

git add *.xlsx

git diff --cached --quiet
if %errorlevel%==0 (
    echo Nenhuma alteracao detectada.
) else (
    git commit -m "Atualização automática (%date% %time%)"
    git push origin main
)

pause
exit

