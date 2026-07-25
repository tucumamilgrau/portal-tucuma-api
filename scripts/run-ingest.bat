@echo off
chcp 65001 >nul
rem Executado pelo Agendador de Tarefas do Windows (tarefa "PortalTucumaMilgrau_IngestNoticias").
rem Busca os feeds de Fato Regional e Agencia Brasil e cria rascunhos novos no banco.
rem Nao publica nada sozinho -- revise e publique em /admin.
set PATH=C:\Program Files\nodejs;%PATH%
cd /d C:\Users\JHONNES\portal-tucuma-api
echo. >> logs\ingest.log
echo ==== %date% %time% ==== >> logs\ingest.log
call npm run ingest >> logs\ingest.log 2>&1
