@echo off
setlocal
echo ============================================================
echo   PlasPrint 3.0 - Git Auto-Commit and Push
echo ============================================================
echo.

:: Verifica se o Git esta instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] O Git nao esta instalado neste computador.
    pause
    exit /b 1
)

:: Verifica se existe um repositorio inicializado
if not exist .git (
    echo [INFO] Inicializando repositorio Git...
    git init
    git branch -M main
    git remote add origin https://github.com/bacchirenan/PlasPrint3.0.git
) else (
    :: Garante que o remote origin esta apontando para o lugar certo
    git branch -M main
    git remote set-url origin https://github.com/bacchirenan/PlasPrint3.0.git
)

:: Puxa as mudancas do servidor para evitar conflitos (opcional mas recomendado)
:: echo [INFO] Sincronizando com o servidor...
:: git pull origin main --rebase

echo.
echo [INFO] Adicionando arquivos...
git add .

set /p msg="Digite a mensagem do commit (ou ENTER para 'Update'): "
if "%msg%"=="" set msg=Update %date% %time%

echo [INFO] Fazendo commit: "%msg%"...
git commit -m "%msg%"

echo.
echo [INFO] Enviando para o GitHub (PlasPrint3.0.git)...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Houve um problema ao enviar os arquivos. 
    echo Verifique se voce tem permissao e se o branch e 'main'.
    pause
) else (
    echo.
    echo [SUCESSO] Arquivos enviados com sucesso!
    timeout /t 3
)
