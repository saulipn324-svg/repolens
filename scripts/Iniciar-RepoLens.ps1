$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instala Node.js 24 para continuar.' }
if (!(Test-Path 'node_modules')) {
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
Write-Host 'RepoLens: abre http://localhost:3006. Usa Ctrl+C para detenerlo.'
npm.cmd run dev -- --port 3006
