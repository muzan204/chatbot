$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot 'artifacts\os-noturnos-discloud.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'artifacts') -Force | Out-Null
$temporary = $target + '.tmp'
if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
$archive = [System.IO.Compression.ZipFile]::Open($temporary, 'Create')
try {
  # Explicit allowlist: never traverse auth/, data/, .env or backups.
  $files = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -Recurse -File)
  foreach ($name in @('package.json', 'package-lock.json', '.env.example', 'discloud.config', 'README.md', 'DISCLOUD.md', 'VALIDACAO.md')) {
    $files += Get-Item -LiteralPath (Join-Path $projectRoot $name)
  }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative) | Out-Null
  }
} finally { $archive.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($temporary)
try {
  if ($check.Entries.Count -ne $files.Count) { throw 'Incomplete package' }
  if (@($check.Entries | Where-Object { $_.FullName -match '(^|/)(auth|data|node_modules|\.git)(/|$)|(^|/)\.env$' }).Count) { throw 'Unsafe package' }
} finally { $check.Dispose() }
Move-Item -LiteralPath $temporary -Destination $target -Force
Write-Output ('Package ready: ' + $target)
