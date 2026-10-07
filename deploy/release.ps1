# Builds the front end, packages only code (never .env, uploads or the database) and applies it on the VPS.
# Usage, from the project root:
#   powershell -ExecutionPolicy Bypass -File deploy\release.ps1             # everyday release
#   powershell -ExecutionPolicy Bypass -File deploy\release.ps1 -Install    # first installation (see install.sh)
param(
  [string]$Server = "root@161.132.51.100",
  [string[]]$Sites = @("https://turadioonline.miacademiapreu.com", "https://consola-fullradio.miacademiapreu.com", "https://control-turadioonline.miacademiapreu.com"),
  [switch]$SkipBuild,
  [switch]$Install
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $SkipBuild) {
  # The bundle talks to the production Reverb through Apache (wss on 443) with the server's public app key.
  $reverbKey = "$(ssh $Server "sed -n 's/^REVERB_APP_KEY=//p' /opt/turadioonline/.env")".Trim().Trim('"')
  if (-not $reverbKey) { throw "REVERB_APP_KEY is missing in /opt/turadioonline/.env" }
  $env:VITE_REVERB_APP_KEY = $reverbKey
  $env:VITE_REVERB_PORT = "443"
  $env:VITE_REVERB_SCHEME = "https"
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  } finally {
    Remove-Item Env:VITE_REVERB_APP_KEY, Env:VITE_REVERB_PORT, Env:VITE_REVERB_SCHEME -ErrorAction SilentlyContinue
  }
}

$parts = @("app", "bootstrap/app.php", "bootstrap/providers.php", "config", "database/migrations", "database/seeders",
  "database/factories", "deploy", "lang", "public/build", "public/favicon.svg", "public/index.php", "public/robots.txt",
  "public/.htaccess", "resources/views", "routes", "artisan", "composer.json", "composer.lock") | Where-Object { Test-Path $_ }

$package = Join-Path $env:TEMP "turadioonline-release.tgz"
if (Test-Path $package) { Remove-Item $package }
tar -czf $package @parts
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
Write-Host ("Package: {0:N1} MB" -f ((Get-Item $package).Length / 1MB))

if ($Install) {
  scp -q $package "${Server}:/tmp/turadioonline.tgz"
  scp -q (Join-Path $PSScriptRoot "install.sh") "${Server}:/root/turadioonline-install.sh"
  if ($LASTEXITCODE -ne 0) { throw "scp failed" }
  ssh $Server "sed -i 's/\r$//' /root/turadioonline-install.sh && bash /root/turadioonline-install.sh"
} else {
  scp -q $package "${Server}:/root/turadioonline-release.tgz"
  scp -q (Join-Path $PSScriptRoot "release.sh") "${Server}:/root/turadioonline-release.sh"
  if ($LASTEXITCODE -ne 0) { throw "scp failed" }
  ssh $Server "sed -i 's/\r$//' /root/turadioonline-release.sh && bash /root/turadioonline-release.sh"
}
if ($LASTEXITCODE -ne 0) { throw "deployment failed on the server" }

foreach ($site in $Sites) {
  foreach ($path in "/up", "/ingresar") {
    $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 25 "$site$path"
    Write-Host "$code  $site$path"
  }
}
