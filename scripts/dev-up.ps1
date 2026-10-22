<#
.SYNOPSIS
  Sobe o ambiente LOCAL com dados fictícios para validação humana.

.DESCRIPTION
  1. Garante Docker e o Supabase local deste projeto.
  2. Aplica as migrações pendentes. Com -Reset, recria o banco a partir das migrações + seed.sql.
  3. Roda scripts/dev-seed.mjs: logins student/teacher/admin .dev, alunos fictícios e
     dados em todas as abas. O script também valida os três logins.
  4. Inicia o Next.js em http://localhost:3000 (a menos que -NoServer).

.PARAMETER Reset
  Apaga e recria o banco LOCAL deste projeto (supabase db reset). Use quando o banco
  estiver à frente desta branch ou com sobras de testes.

.PARAMETER NoServer
  Não inicia o servidor Next.js no final.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Reset
#>
param([switch]$Reset, [switch]$NoServer)

# Programas nativos (npx, node, docker) escrevem progresso no stderr; o resultado é julgado
# pelo código de saída ($LASTEXITCODE), não pelo stderr.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step([string]$message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Fail([string]$message) { Write-Host "`nERRO: $message" -ForegroundColor Red; exit 1 }
function Invoke-Checked([string]$label, [scriptblock]$command, [switch]$Quiet) {
  if ($Quiet) {
    $output = & $command 2>&1
    if ($LASTEXITCODE -ne 0) { $output | ForEach-Object { Write-Host $_ }; Fail "$label falhou (código $LASTEXITCODE)." }
  } else {
    & $command 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { Fail "$label falhou (código $LASTEXITCODE)." }
  }
}

# ------------------------------------------------------------------ Docker
# `docker info` pode travar para sempre quando o Docker Desktop está preso: limita a espera.
function Test-Docker([int]$Seconds = 20) {
  $process = Start-Process docker -ArgumentList 'info', '--format', '{{.ServerVersion}}' `
    -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\yas-docker-out.txt" `
    -RedirectStandardError "$env:TEMP\yas-docker-err.txt"
  if (-not $process.WaitForExit($Seconds * 1000)) {
    try { $process.Kill() } catch {}
    return 'hung'
  }
  if ($process.ExitCode -eq 0) { return 'ok' } else { return 'down' }
}

Step 'Docker'
$docker = Test-Docker
if ($docker -eq 'down') {
  $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path $desktop)) { Fail 'Docker não está rodando e o Docker Desktop não foi encontrado.' }
  Write-Host 'Iniciando o Docker Desktop (até 3 minutos)...'
  Start-Process $desktop
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 5
    $docker = Test-Docker
  } while ($docker -ne 'ok' -and (Get-Date) -lt $deadline)
}
if ($docker -eq 'hung') {
  Fail @'
O Docker Desktop está aberto, mas o motor não responde (docker info travou).
Reinicie o Docker: clique com o botão direito no ícone da baleia > "Restart"
(ou feche o Docker Desktop, rode "wsl --shutdown" e abra de novo). Depois rode este comando outra vez.
'@
}
if ($docker -ne 'ok') { Fail 'O Docker não ficou pronto em 3 minutos.' }
Write-Host 'Docker OK.'

# ------------------------------------------------------------------ Supabase
Step 'Supabase local'
Invoke-Checked 'supabase start' { npx supabase start } -Quiet
Write-Host 'Supabase local OK (Studio: http://127.0.0.1:55323).'

# ------------------------------------------------------------------ Migrações
Step 'Migrações'
if ($Reset) {
  Write-Host 'Recriando o banco local (migrações + seed.sql)...' -ForegroundColor Yellow
  Invoke-Checked 'supabase db reset' { npx supabase db reset }
} else {
  # A CLI imprime JSON quando a saída não é um terminal e tabela quando é: aceita os dois.
  $list = (npx supabase migration list --local 2>$null) -join "`n"
  $jsonStart = $list.IndexOf('{"migrations"')
  if ($jsonStart -ge 0) {
    $rows = (($list.Substring($jsonStart)) | ConvertFrom-Json).migrations |
      ForEach-Object { [pscustomobject]@{ Local = $_.local; Remote = $_.remote } }
  } else {
    $rows = foreach ($line in $list -split "`n") {
      if ($line -match '^\s*`(\d{14})?\s*`\s*\|\s*`(\d{14})?\s*`\s*\|') {
        [pscustomobject]@{ Local = $Matches[1]; Remote = $Matches[2] }
      }
    }
  }
  if (-not $rows) { Fail 'Não foi possível ler o estado das migrações (npx supabase migration list --local).' }
  $pending = @($rows | Where-Object { $_.Local -and -not $_.Remote })
  $ahead = @($rows | Where-Object { $_.Remote -and -not $_.Local })
  if ($ahead.Count -gt 0) {
    Write-Host ("O banco local tem migrações que esta branch não tem: {0}." -f ($ahead.Remote -join ', ')) -ForegroundColor Yellow
    Write-Host 'Elas vieram de outra branch (por exemplo, main). O banco segue utilizável.' -ForegroundColor Yellow
    if ($pending.Count -gt 0) {
      Fail ("Há {0} migração(ões) desta branch pendente(s) e o histórico divergiu. Rode de novo com -Reset." -f $pending.Count)
    }
  } elseif ($pending.Count -gt 0) {
    Write-Host ("Aplicando {0} migração(ões) pendente(s)..." -f $pending.Count)
    Invoke-Checked 'supabase migration up' { npx supabase migration up --local }
  }
  if ($pending.Count -eq 0) { Write-Host 'Nenhuma migração pendente.' }
}

# ------------------------------------------------------------------ Ambiente
Step 'Variáveis (.env.local)'
if (-not (Test-Path '.env.local')) { Fail '.env.local não existe. Copie de .env.example e preencha as chaves do Supabase local (npx supabase status).' }
foreach ($line in Get-Content '.env.local') {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$($Matches[1])" -Value $value
  }
}
Write-Host 'OK.'

# ------------------------------------------------------------------ Dados fictícios + validação dos logins
Step 'Dados fictícios e validação dos logins'
Invoke-Checked 'dev-seed' { node scripts/dev-seed.mjs }

if ($NoServer) { exit 0 }

# ------------------------------------------------------------------ Servidor
Step 'Servidor Next.js'
$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  $owner = Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue
  Fail ("A porta 3000 já está em uso por {0} (PID {1}). Feche esse processo e rode de novo." -f $owner.ProcessName, $busy[0].OwningProcess)
}
Write-Host @'

  Abra http://localhost:3000/login
    Aluno      student.dev@example.test  /  YasStudent123!
    Professor  teacher.dev@example.test  /  YasTeacher123!   (pede autenticador no 1º acesso)
    Admin      admin.dev@example.test    /  YasAdmin123!     (pede autenticador no 1º acesso)

  Ctrl+C encerra o servidor.
'@ -ForegroundColor Green
npm run dev
