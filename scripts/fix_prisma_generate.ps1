# fix_prisma_generate.ps1
# Run this in an elevated PowerShell (Run as Administrator) from the project root.
# It will stop node processes, remove Prisma client temp files, reinstall dependencies,
# and regenerate the Prisma client.

param(
    [switch]$SkipInstall
)

Write-Host "Running Prisma generate fixer..." -ForegroundColor Cyan

# 1) Stop node processes
try {
    $nodes = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodes) {
        Write-Host "Stopping node processes..." -ForegroundColor Yellow
        $nodes | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    } else {
        Write-Host "No node processes found." -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to stop node processes: $_" -ForegroundColor Red
}

# 2) Remove prisma client temp files and client folder
$prismaClientDir = Join-Path -Path $PSScriptRoot -ChildPath "..\node_modules\.prisma\client"
$prismaClientDir = (Resolve-Path $prismaClientDir -ErrorAction SilentlyContinue)
if ($prismaClientDir) { $prismaClientDir = $prismaClientDir.Path } else { $prismaClientDir = Join-Path $PSScriptRoot '..\node_modules\.prisma\client' }

Write-Host "Cleaning Prisma client folder: $prismaClientDir" -ForegroundColor Yellow
try {
    if (Test-Path $prismaClientDir) {
        Get-ChildItem -Path $prismaClientDir -Filter "query_engine-windows.dll.node.tmp*" -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
        Remove-Item -Recurse -Force $prismaClientDir -ErrorAction SilentlyContinue
        Write-Host "Removed Prisma client folder and temp files." -ForegroundColor Green
    } else {
        Write-Host "Prisma client folder not present, skipping removal." -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to remove prisma client files: $_" -ForegroundColor Red
}

# 3) Optionally remove node_modules to ensure clean install
if (-not $SkipInstall) {
    Write-Host "Removing node_modules to ensure clean install..." -ForegroundColor Yellow
    try {
        $nm = Join-Path $PSScriptRoot "..\node_modules"
        if (Test-Path $nm) { Remove-Item -Recurse -Force $nm -ErrorAction SilentlyContinue; Write-Host "Removed node_modules." -ForegroundColor Green } else { Write-Host "node_modules not found, skipping." -ForegroundColor Green }
    } catch {
        Write-Host "Failed to remove node_modules: $_" -ForegroundColor Red
    }

    # remove package-lock.json if exists (optional)
    try {
        $pl = Join-Path $PSScriptRoot "..\package-lock.json"
        if (Test-Path $pl) { Remove-Item -Force $pl -ErrorAction SilentlyContinue; Write-Host "Removed package-lock.json." -ForegroundColor Green }
    } catch {
        Write-Host "Failed to remove package-lock.json: $_" -ForegroundColor Red
    }

    # 4) Reinstall dependencies
    Write-Host "Running npm install..." -ForegroundColor Yellow
    # On Windows use npm.cmd; Start-Process fails when launching shell shims like 'npm'
    $npmCmd = if (Test-Path "$env:ProgramFiles\nodejs\npm.cmd") { 'npm.cmd' } else { 'npm' }
    $install = Start-Process -FilePath $npmCmd -ArgumentList 'install' -NoNewWindow -Wait -PassThru
    if ($install.ExitCode -ne 0) {
        Write-Host "npm install failed with exit code $($install.ExitCode). Check output above." -ForegroundColor Red
        exit $install.ExitCode
    }
}

# 5) Run prisma generate
Write-Host "Running npx prisma generate..." -ForegroundColor Yellow
# Use npx.cmd on Windows when available
$npxCmd = if (Test-Path "$env:ProgramFiles\nodejs\npx.cmd") { 'npx.cmd' } else { 'npx' }
$gen = Start-Process -FilePath $npxCmd -ArgumentList 'prisma generate' -NoNewWindow -Wait -PassThru
if ($gen.ExitCode -ne 0) {
    Write-Host "prisma generate failed with exit code $($gen.ExitCode)." -ForegroundColor Red
    exit $gen.ExitCode
} else {
    Write-Host "prisma generate completed successfully." -ForegroundColor Green
}

Write-Host "Done. You can now run 'npm run dev' to start the dev server." -ForegroundColor Cyan
